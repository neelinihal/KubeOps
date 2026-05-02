package com.devops.service;

import com.devops.config.EksConfig;
import com.devops.dto.CommandInfo;
import com.devops.model.CommandExecution;
import com.devops.model.K8sCache;
import com.devops.model.K8sEvent;
import com.devops.repository.CommandExecutionRepository;
import com.devops.repository.K8sCacheRepository;
import com.devops.repository.K8sEventRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.TimeUnit;

@Service
public class KubectlService {

    private static final Logger log = LoggerFactory.getLogger(KubectlService.class);
    private static final String COMMAND_PREFIX = "kubectl.commands.";
    private static final Pattern PARAM_PATTERN = Pattern.compile("\\{(\\w+)}");
    private static final Pattern SAFE_PARAM = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9\\-._]*$");
    private static final Set<String> ALLOWED_KUBECTL_VERBS = Set.of(
        "get", "describe", "logs", "top", "explain", "api-resources", "api-versions",
        "cluster-info", "config", "version", "auth"
    );
    private static final Set<String> BLOCKED_VERBS = Set.of(
        "delete", "apply", "create", "patch", "replace", "edit", "label", "annotate",
        "taint", "drain", "cordon", "uncordon", "exec", "attach", "port-forward",
        "proxy", "cp", "run"
    );

    @Autowired
    private CommandExecutionRepository repository;

    @Autowired
    private K8sEventRepository eventRepository;

    @Autowired
    private K8sCacheRepository cacheRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private Environment env;

    @Autowired
    private EksConfig eksConfig;

    @Cacheable(value = "availableCommands", key = "'all'")
    public List<CommandInfo> getAvailableCommands() {
        List<CommandInfo> commands = new ArrayList<>();
        // We iterate known keys since Environment doesn't expose prefix enumeration easily
        String[] knownKeys = {
            "get-pods", "get-services", "get-deployments", "get-nodes",
            "get-namespaces", "get-logs", "describe-pod", "get-events",
            "describe-configmap", "describe-secret",
            "restart-deployment", "scale-deployment", "rollout-status",
            "delete-pod", "top-pods", "top-nodes", "get-ingress", "get-hpa"
        };
        for (String key : knownKeys) {
            String template = env.getProperty(COMMAND_PREFIX + key);
            if (template != null) {
                List<String> params = extractParams(template);
                commands.add(new CommandInfo(key, template, params));
            }
        }
        return commands;
    }

    @CacheEvict(value = "executionHistory", allEntries = true)
    public CommandExecution executeCommand(String commandKey, Map<String, String> params) {
        String template = env.getProperty(COMMAND_PREFIX + commandKey);
        if (template == null) {
            throw new IllegalArgumentException("Unknown command: " + commandKey);
        }

        String fullCommand = resolveParams(template, params != null ? params : Map.of());

        CommandExecution execution = new CommandExecution();
        execution.setCommandName(commandKey);
        execution.setFullCommand(fullCommand);
        execution.setExecutedAt(LocalDateTime.now());

        try {
            String output = runProcess(fullCommand);
            execution.setOutput(output);
            execution.setStatus("SUCCESS");
        } catch (Exception e) {
            log.error("Command execution failed: {}", fullCommand, e);
            execution.setOutput(e.getMessage());
            execution.setStatus("FAILED");
        }

        return repository.save(execution);
    }

    @Cacheable(value = "executionHistory", key = "'history'")
    public List<CommandExecution> getHistory() {
        return repository.findAllByOrderByExecutedAtDesc();
    }

    @CacheEvict(value = "executionHistory", allEntries = true)
    public CommandExecution executeCustomCommand(String rawCommand) {
        if (rawCommand == null || rawCommand.isBlank()) {
            throw new IllegalArgumentException("Command cannot be empty");
        }

        String cmd = rawCommand.trim();

        // Must start with kubectl
        if (!cmd.startsWith("kubectl ")) {
            throw new IllegalArgumentException("Only kubectl commands are allowed");
        }

        // Extract the verb (second token)
        String[] tokens = cmd.split("\\s+");
        if (tokens.length < 2) {
            throw new IllegalArgumentException("Invalid kubectl command");
        }
        String verb = tokens[1].toLowerCase();

        // Block dangerous verbs
        if (BLOCKED_VERBS.contains(verb)) {
            throw new IllegalArgumentException("Command '" + verb + "' is not allowed for safety reasons");
        }

        // Block shell injection characters
        if (cmd.contains(";") || cmd.contains("|") || cmd.contains("&") || cmd.contains("`")
                || cmd.contains("$") || cmd.contains("(") || cmd.contains(">") || cmd.contains("<")) {
            throw new IllegalArgumentException("Special characters are not allowed");
        }

        CommandExecution execution = new CommandExecution();
        execution.setCommandName("custom: " + verb);
        execution.setFullCommand(cmd);
        execution.setExecutedAt(LocalDateTime.now());

        try {
            String output = runProcess(cmd);
            execution.setOutput(output);
            execution.setStatus("SUCCESS");
        } catch (Exception e) {
            log.error("Custom command failed: {}", cmd, e);
            execution.setOutput(e.getMessage());
            execution.setStatus("FAILED");
        }

        return repository.save(execution);
    }

    /**
     * Returns cluster status: pods, deployments, nodes with parsed fields.
     */
    @Cacheable(value = "clusterStatus", key = "'status'")
    /**
     * Returns cluster status from DB cache. Instant load for UI.
     */
    public Map<String, Object> getCachedClusterStatus() {
        try {
            var cached = cacheRepository.findByCacheKey("cluster-status");
            if (cached.isPresent()) {
                Map<String, Object> result = objectMapper.readValue(cached.get().getData(), new TypeReference<>() {});
                result.put("cachedAt", cached.get().getFetchedAt().toString());
                return result;
            }
        } catch (Exception e) {
            log.error("Failed to read cached cluster status", e);
        }
        return getClusterStatus();
    }

    /**
     * Fetches fresh cluster status from cluster, saves to DB, returns it.
     */
    @jakarta.transaction.Transactional
    public Map<String, Object> refreshClusterStatus() {
        Map<String, Object> status = getClusterStatus();
        try {
            String json = objectMapper.writeValueAsString(status);
            var cached = cacheRepository.findByCacheKey("cluster-status");
            K8sCache cache;
            if (cached.isPresent()) {
                cache = cached.get();
                cache.setData(json);
                cache.setFetchedAt(java.time.LocalDateTime.now());
            } else {
                cache = new K8sCache("cluster-status", json);
            }
            cacheRepository.save(cache);
        } catch (Exception e) {
            log.error("Failed to cache cluster status", e);
        }
        return status;
    }

    /**
     * Returns top pods from DB cache. Instant load for UI.
     */
    public List<Map<String, String>> getCachedTopPods(String namespace) {
        try {
            String key = "top-pods" + (namespace != null && !namespace.isBlank() ? "-" + namespace : "");
            var cached = cacheRepository.findByCacheKey(key);
            if (cached.isPresent()) {
                return objectMapper.readValue(cached.get().getData(), new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("Failed to read cached top pods", e);
        }
        return refreshTopPods(namespace);
    }

    /**
     * Fetches fresh top pods from cluster, saves to DB, returns them.
     */
    @jakarta.transaction.Transactional
    public List<Map<String, String>> refreshTopPods(String namespace) {
        List<Map<String, String>> pods = getTopPods(namespace);
        try {
            String key = "top-pods" + (namespace != null && !namespace.isBlank() ? "-" + namespace : "");
            String json = objectMapper.writeValueAsString(pods);
            var cached = cacheRepository.findByCacheKey(key);
            K8sCache cache;
            if (cached.isPresent()) {
                cache = cached.get();
                cache.setData(json);
                cache.setFetchedAt(java.time.LocalDateTime.now());
            } else {
                cache = new K8sCache(key, json);
            }
            cacheRepository.save(cache);
        } catch (Exception e) {
            log.error("Failed to cache top pods", e);
        }
        return pods;
    }

    /**
     * Returns top nodes from DB cache. Instant load for UI.
     */
    public List<Map<String, String>> getCachedTopNodes() {
        try {
            var cached = cacheRepository.findByCacheKey("top-nodes");
            if (cached.isPresent()) {
                return objectMapper.readValue(cached.get().getData(), new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.error("Failed to read cached top nodes", e);
        }
        return refreshTopNodes();
    }

    /**
     * Fetches fresh top nodes from cluster, saves to DB, returns them.
     */
    @jakarta.transaction.Transactional
    public List<Map<String, String>> refreshTopNodes() {
        List<Map<String, String>> nodes = getTopNodes();
        try {
            String json = objectMapper.writeValueAsString(nodes);
            var cached = cacheRepository.findByCacheKey("top-nodes");
            K8sCache cache;
            if (cached.isPresent()) {
                cache = cached.get();
                cache.setData(json);
                cache.setFetchedAt(java.time.LocalDateTime.now());
            } else {
                cache = new K8sCache("top-nodes", json);
            }
            cacheRepository.save(cache);
        } catch (Exception e) {
            log.error("Failed to cache top nodes", e);
        }
        return nodes;
    }

    public Map<String, Object> getClusterStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("timestamp", LocalDateTime.now().toString());

        // Pods
        try {
            String output = runProcess("kubectl get pods -A --no-headers");
            List<Map<String, String>> pods = new ArrayList<>();
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 5) {
                    Map<String, String> pod = new LinkedHashMap<>();
                    pod.put("namespace", cols[0]);
                    pod.put("name", cols[1]);
                    pod.put("ready", cols[2]);
                    pod.put("status", cols[3]);
                    pod.put("restarts", cols[4]);
                    pod.put("age", cols.length >= 6 ? cols[5] : "");
                    pods.add(pod);
                }
            }
            status.put("pods", pods);
        } catch (Exception e) {
            log.error("Failed to get pods", e);
            status.put("pods", List.of());
            status.put("podsError", e.getMessage());
        }

        // Deployments
        try {
            String output = runProcess("kubectl get deployments -A --no-headers");
            List<Map<String, String>> deployments = new ArrayList<>();
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 5) {
                    Map<String, String> dep = new LinkedHashMap<>();
                    dep.put("namespace", cols[0]);
                    dep.put("name", cols[1]);
                    dep.put("ready", cols[2]);
                    dep.put("upToDate", cols[3]);
                    dep.put("available", cols[4]);
                    dep.put("age", cols.length >= 6 ? cols[5] : "");
                    deployments.add(dep);
                }
            }
            status.put("deployments", deployments);
        } catch (Exception e) {
            log.error("Failed to get deployments", e);
            status.put("deployments", List.of());
        }

        // Nodes
        try {
            String output = runProcess("kubectl get nodes --no-headers");
            List<Map<String, String>> nodes = new ArrayList<>();
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 5) {
                    Map<String, String> node = new LinkedHashMap<>();
                    node.put("name", cols[0]);
                    node.put("status", cols[1]);
                    node.put("roles", cols[2]);
                    node.put("age", cols[3]);
                    node.put("version", cols[4]);
                    nodes.add(node);
                }
            }
            status.put("nodes", nodes);
        } catch (Exception e) {
            log.error("Failed to get nodes", e);
            status.put("nodes", List.of());
        }

        // Namespaces
        try {
            String output = runProcess("kubectl get namespaces --no-headers");
            List<Map<String, String>> namespaces = new ArrayList<>();
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 3) {
                    Map<String, String> ns = new LinkedHashMap<>();
                    ns.put("name", cols[0]);
                    ns.put("status", cols[1]);
                    ns.put("age", cols[2]);
                    namespaces.add(ns);
                }
            }
            status.put("namespaces", namespaces);
        } catch (Exception e) {
            log.error("Failed to get namespaces", e);
            status.put("namespaces", List.of());
        }

        return status;
    }

    /**
     * Fetches resource names (pods, namespaces, deployments, etc.) by running kubectl.
     */
    @Cacheable(value = "resourceNames", key = "#resourceType + '-' + #namespace")
    public Map<String, List<String>> fetchResourceNames(String resourceType, String namespace) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        try {
            String cmd;
            if ("namespace".equals(resourceType)) {
                cmd = "kubectl get namespaces --no-headers -o custom-columns=NAME:.metadata.name";
            } else {
                String ns = (namespace != null && !namespace.isBlank()) ? namespace : "--all-namespaces";
                if ("--all-namespaces".equals(ns)) {
                    cmd = "kubectl get " + resourceType + " -A --no-headers -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name";
                } else {
                    if (!SAFE_PARAM.matcher(ns).matches()) {
                        throw new IllegalArgumentException("Invalid namespace");
                    }
                    cmd = "kubectl get " + resourceType + " -n " + ns + " --no-headers -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name";
                }
            }

            String output = runProcess(cmd);
            if (output != null && !output.isBlank()) {
                for (String line : output.split("\n")) {
                    String trimmed = line.trim();
                    if (trimmed.isEmpty()) continue;
                    if ("namespace".equals(resourceType)) {
                        result.computeIfAbsent("cluster", k -> new ArrayList<>()).add(trimmed);
                    } else {
                        String[] parts = trimmed.split("\\s+", 2);
                        if (parts.length == 2) {
                            result.computeIfAbsent(parts[0], k -> new ArrayList<>()).add(parts[1]);
                        } else {
                            result.computeIfAbsent("default", k -> new ArrayList<>()).add(parts[0]);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch resource names for type: {}", resourceType, e);
        }
        return result;
    }

    private String resolveParams(String template, Map<String, String> params) {
        Matcher matcher = PARAM_PATTERN.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String paramName = matcher.group(1);
            String value = params.get(paramName);
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Missing required parameter: " + paramName);
            }
            if (!SAFE_PARAM.matcher(value).matches()) {
                throw new IllegalArgumentException("Invalid parameter value: " + paramName);
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private List<String> extractParams(String template) {
        Matcher matcher = PARAM_PATTERN.matcher(template);
        List<String> params = new ArrayList<>();
        while (matcher.find()) {
            params.add(matcher.group(1));
        }
        return params;
    }

    private String runProcess(String command) throws Exception {
        String[] parts = command.split("\\s+");
        ProcessBuilder pb = new ProcessBuilder(parts);
        pb.redirectErrorStream(true);

        // On local dev: pass AWS credentials to kubectl. On EC2: IAM role handles it.
        if (!eksConfig.isRunningOnEc2()) {
            String ak = eksConfig.getAccessKey();
            if (ak != null && !ak.isBlank()) {
                pb.environment().put("AWS_ACCESS_KEY_ID", ak);
                pb.environment().put("AWS_SECRET_ACCESS_KEY", eksConfig.getSecretKey());
                pb.environment().put("AWS_DEFAULT_REGION", eksConfig.getRegion());
                String token = eksConfig.getSessionToken();
                if (token != null && !token.isBlank()) {
                    pb.environment().put("AWS_SESSION_TOKEN", token);
                }
            }
        }

        Process process = pb.start();

        StringBuilder outputBuilder = new StringBuilder();
        Thread readerThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (outputBuilder.length() > 0) outputBuilder.append("\n");
                    outputBuilder.append(line);
                }
            } catch (Exception ignored) {}
        });
        readerThread.start();

        boolean finished = process.waitFor(30, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            readerThread.interrupt();
            throw new RuntimeException("Command timed out after 30 seconds");
        }
        readerThread.join(2000);

        String output = outputBuilder.toString();
        int exitCode = process.exitValue();
        if (exitCode != 0) {
            throw new RuntimeException("Command exited with code " + exitCode + ": " + output);
        }
        return output;
    }

    public List<Map<String, String>> getTopPods(String namespace) {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            String cmd = "kubectl top pods";
            if (namespace != null && !namespace.isBlank()) {
                if (!SAFE_PARAM.matcher(namespace).matches()) {
                    throw new IllegalArgumentException("Invalid namespace");
                }
                cmd += " -n " + namespace;
            } else {
                cmd += " -A";
            }
            cmd += " --no-headers";
            String output = runProcess(cmd);
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 3) {
                    Map<String, String> pod = new LinkedHashMap<>();
                    if (namespace == null || namespace.isBlank()) {
                        if (cols.length >= 4) {
                            pod.put("namespace", cols[0]);
                            pod.put("name", cols[1]);
                            pod.put("cpu", cols[2]);
                            pod.put("memory", cols[3]);
                        }
                    } else {
                        pod.put("namespace", namespace);
                        pod.put("name", cols[0]);
                        pod.put("cpu", cols[1]);
                        pod.put("memory", cols[2]);
                    }
                    if (!pod.isEmpty()) result.add(pod);
                }
            }
        } catch (Exception e) {
            log.error("Failed to get top pods", e);
        }
        return result;
    }

    public List<Map<String, String>> getTopNodes() {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            String output = runProcess("kubectl top nodes --no-headers");
            for (String line : output.split("\n")) {
                String[] cols = line.trim().split("\\s+");
                if (cols.length >= 5) {
                    Map<String, String> node = new LinkedHashMap<>();
                    node.put("name", cols[0]);
                    node.put("cpuCores", cols[1]);
                    node.put("cpuPercent", cols[2]);
                    node.put("memoryBytes", cols[3]);
                    node.put("memoryPercent", cols[4]);
                    result.add(node);
                }
            }
        } catch (Exception e) {
            log.error("Failed to get top nodes", e);
        }
        return result;
    }

    /**
     * Returns events from DB. Fast load for UI.
     */
    public List<Map<String, String>> getEvents(String namespace, String type) {
        List<K8sEvent> dbEvents;
        if (namespace != null && !namespace.isBlank()) {
            dbEvents = eventRepository.findByNamespaceOrderByLastSeenDesc(namespace);
        } else {
            dbEvents = eventRepository.findAllByOrderByLastSeenDesc();
        }

        List<Map<String, String>> result = new ArrayList<>();
        for (K8sEvent e : dbEvents) {
            if (type != null && !type.isBlank() && !e.getType().equalsIgnoreCase(type)) {
                continue;
            }
            if ("<nil>".equals(e.getLastSeen()) || "<none>".equals(e.getLastSeen())) {
                continue;
            }
            Map<String, String> event = new LinkedHashMap<>();
            event.put("namespace", e.getNamespace());
            event.put("lastSeen", e.getLastSeen());
            event.put("type", e.getType());
            event.put("reason", e.getReason());
            event.put("object", e.getObject());
            event.put("message", e.getMessage());
            result.add(event);
        }
        return result;
    }

    /**
     * Fetches fresh events from cluster, saves to DB, and returns them.
     */
    @jakarta.transaction.Transactional
    public List<Map<String, String>> refreshEvents(String namespace, String type) {
        List<Map<String, String>> result = new ArrayList<>();
        try {
            String cmd = "kubectl get events --sort-by=.lastTimestamp";
            if (namespace != null && !namespace.isBlank()) {
                if (!SAFE_PARAM.matcher(namespace).matches()) {
                    throw new IllegalArgumentException("Invalid namespace");
                }
                cmd += " -n " + namespace;
            } else {
                cmd += " -A";
            }
            cmd += " -o custom-columns=NAMESPACE:.metadata.namespace,LAST_SEEN:.lastTimestamp,TYPE:.type,REASON:.reason,KIND:.involvedObject.kind,NAME:.involvedObject.name,MESSAGE:.message --no-headers";
            String output = runProcess(cmd);

            // Delete events older than 3 hours, keep recent ones
            LocalDateTime now = LocalDateTime.now();
            eventRepository.deleteOlderThan(now.minusHours(3));

            List<K8sEvent> newEvents = new ArrayList<>();

            for (String line : output.split("\n")) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                String[] cols = trimmed.split("\\s{2,}", 7);
                if (cols.length >= 6) {
                    String lastSeen = cols[1].trim();
                    // Skip events with no timestamp
                    if (lastSeen.equals("<nil>") || lastSeen.equals("<none>")) continue;

                    String kind = cols[4].trim();
                    String name = cols[5].trim();
                    String objectStr = (kind.equals("<none>") && name.equals("<none>")) ? "<none>" : kind + "/" + name;

                    Map<String, String> event = new LinkedHashMap<>();
                    event.put("namespace", cols[0].trim());
                    event.put("lastSeen", cols[1].trim());
                    event.put("type", cols[2].trim());
                    event.put("reason", cols[3].trim());
                    event.put("object", objectStr);
                    event.put("message", cols.length >= 7 ? cols[6].trim() : "");

                    // Upsert: update if exists, create if not
                    var existingList = eventRepository.findByNamespaceAndReasonAndObjectAndMessage(
                            event.get("namespace"), event.get("reason"), event.get("object"), event.get("message"));
                    K8sEvent dbEvent;
                    if (!existingList.isEmpty()) {
                        dbEvent = existingList.get(0);
                        // Remove duplicates if any
                        for (int dup = 1; dup < existingList.size(); dup++) {
                            eventRepository.delete(existingList.get(dup));
                        }
                        dbEvent.setLastSeen(event.get("lastSeen"));
                        dbEvent.setType(event.get("type"));
                        dbEvent.setFetchedAt(now);
                    } else {
                        dbEvent = new K8sEvent();
                        dbEvent.setNamespace(event.get("namespace"));
                        dbEvent.setLastSeen(event.get("lastSeen"));
                        dbEvent.setType(event.get("type"));
                        dbEvent.setReason(event.get("reason"));
                        dbEvent.setObject(event.get("object"));
                        dbEvent.setMessage(event.get("message"));
                        dbEvent.setFetchedAt(now);
                    }
                    newEvents.add(dbEvent);

                    if (type != null && !type.isBlank() && !event.get("type").equalsIgnoreCase(type)) {
                        continue;
                    }
                    result.add(event);
                }
            }
            eventRepository.saveAll(newEvents);
        } catch (Exception e) {
            log.error("Failed to refresh events from cluster", e);
        }
        // Return latest first
        Collections.reverse(result);
        return result;
    }
}
