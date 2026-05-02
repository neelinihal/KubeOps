package com.devops.controller;

import com.devops.config.EksConfig;
import com.devops.dto.CommandInfo;
import com.devops.dto.CommandRequest;
import com.devops.model.CommandExecution;
import com.devops.service.KubectlService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/kubectl")
@CrossOrigin(origins = "*")
public class KubectlController {

    @Autowired
    private KubectlService kubectlService;

    @Autowired
    private EksConfig eksConfig;

    @GetMapping("/commands")
    public ResponseEntity<List<CommandInfo>> getCommands() {
        return ResponseEntity.ok(kubectlService.getAvailableCommands());
    }

    @PostMapping("/execute")
    public ResponseEntity<CommandExecution> execute(@RequestBody CommandRequest request) {
        CommandExecution result = kubectlService.executeCommand(request.getCommand(), request.getParams());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/history")
    public ResponseEntity<List<CommandExecution>> getHistory() {
        return ResponseEntity.ok(kubectlService.getHistory());
    }

    @GetMapping("/resources/{resourceType}")
    public ResponseEntity<Map<String, List<String>>> getResources(
            @PathVariable String resourceType,
            @RequestParam(required = false) String namespace) {
        return ResponseEntity.ok(kubectlService.fetchResourceNames(resourceType, namespace));
    }

    @GetMapping("/cluster-status")
    public ResponseEntity<Map<String, Object>> getClusterStatus() {
        return ResponseEntity.ok(kubectlService.getCachedClusterStatus());
    }

    @GetMapping("/cluster-status/refresh")
    public ResponseEntity<Map<String, Object>> refreshClusterStatus() {
        return ResponseEntity.ok(kubectlService.refreshClusterStatus());
    }

    @GetMapping("/cluster-info")
    public ResponseEntity<Map<String, String>> getClusterInfo() {
        Map<String, String> info = new LinkedHashMap<>();
        info.put("clusterName", eksConfig.getClusterName());
        info.put("region", eksConfig.getRegion());
        return ResponseEntity.ok(info);
    }

    @PostMapping("/execute-custom")
    public ResponseEntity<CommandExecution> executeCustom(@RequestBody Map<String, String> body) {
        String command = body.get("command");
        CommandExecution result = kubectlService.executeCustomCommand(command);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/top/pods")
    public ResponseEntity<List<Map<String, String>>> getTopPods(
            @RequestParam(required = false) String namespace) {
        return ResponseEntity.ok(kubectlService.getCachedTopPods(namespace));
    }

    @GetMapping("/top/pods/refresh")
    public ResponseEntity<List<Map<String, String>>> refreshTopPods(
            @RequestParam(required = false) String namespace) {
        return ResponseEntity.ok(kubectlService.refreshTopPods(namespace));
    }

    @GetMapping("/top/nodes")
    public ResponseEntity<List<Map<String, String>>> getTopNodes() {
        return ResponseEntity.ok(kubectlService.getCachedTopNodes());
    }

    @GetMapping("/top/nodes/refresh")
    public ResponseEntity<List<Map<String, String>>> refreshTopNodes() {
        return ResponseEntity.ok(kubectlService.refreshTopNodes());
    }

    @GetMapping("/events")
    public ResponseEntity<List<Map<String, String>>> getEvents(
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) String type) {
        return ResponseEntity.ok(kubectlService.getEvents(namespace, type));
    }

    @GetMapping("/events/refresh")
    public ResponseEntity<List<Map<String, String>>> refreshEvents(
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) String type) {
        return ResponseEntity.ok(kubectlService.refreshEvents(namespace, type));
    }
}
