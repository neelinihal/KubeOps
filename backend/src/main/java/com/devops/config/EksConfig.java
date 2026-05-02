package com.devops.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class EksConfig implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EksConfig.class);

    @Value("${aws.region:}")
    private String configRegion;

    @Value("${aws.eks.cluster-name:}")
    private String configClusterName;

    // Resolved at runtime from CLI / kubeconfig / EC2 metadata
    private String region;
    private String clusterName;
    private String resolvedAccessKey;
    private String resolvedSecretKey;
    private String resolvedSessionToken;
    private boolean runningOnEc2 = false;

    @Override
    public void run(String... args) {
        try {
            runningOnEc2 = detectEc2();

            if (runningOnEc2) {
                log.info("Running on EC2/EKS — using IAM instance role");
                // Get region from EC2 metadata
                if (configRegion == null || configRegion.isBlank()) {
                    try {
                        region = runCommand("curl", "-s", "--connect-timeout", "2",
                                "http://169.254.169.254/latest/meta-data/placement/region").trim();
                    } catch (Exception e) {
                        region = "eu-north-1";
                    }
                } else {
                    region = configRegion;
                }
            } else {
                log.info("Running locally — reading from AWS CLI session");

                // Read region from CLI
                if (configRegion == null || configRegion.isBlank()) {
                    try {
                        region = runCommand("aws", "configure", "get", "region").trim();
                    } catch (Exception e) {
                        region = "eu-north-1";
                    }
                } else {
                    region = configRegion;
                }

                // Read credentials from CLI
                try {
                    resolvedAccessKey = runCommand("aws", "configure", "get", "aws_access_key_id").trim();
                    resolvedSecretKey = runCommand("aws", "configure", "get", "aws_secret_access_key").trim();
                } catch (Exception e) {
                    log.warn("Could not read CLI credentials, relying on default chain");
                }
                try {
                    resolvedSessionToken = runCommand("aws", "configure", "get", "aws_session_token").trim();
                } catch (Exception ignored) {}
            }

            log.info("Resolved region: {}", region);

            // Resolve cluster name from CLI kubeconfig if not set
            if (configClusterName == null || configClusterName.isBlank()) {
                clusterName = detectClusterFromKubeconfig();
            } else {
                clusterName = configClusterName;
            }
            log.info("Resolved cluster: {}", clusterName);

            // Verify identity
            String identity = runCommand("aws", "sts", "get-caller-identity", "--region", region);
            log.info("AWS Identity: {}", identity);

            // Update kubeconfig
            log.info("Updating kubeconfig for cluster '{}' in region '{}'...", clusterName, region);
            String output = runCommand("aws", "eks", "update-kubeconfig",
                    "--name", clusterName, "--region", region);
            log.info("Kubeconfig updated: {}", output);

            // Verify kubectl
            String clusterInfo = runCommand("kubectl", "cluster-info");
            log.info("Cluster connected: {}", clusterInfo.split("\n")[0]);

        } catch (Exception e) {
            log.error("EKS setup failed: {}", e.getMessage());
        }
    }

    /**
     * Detect cluster name from current kubeconfig context.
     * Context format: arn:aws:eks:region:account:cluster/cluster-name
     */
    private String detectClusterFromKubeconfig() {
        try {
            String context = runCommand("kubectl", "config", "current-context").trim();
            log.info("Current kubeconfig context: {}", context);
            // Extract cluster name from ARN: arn:aws:eks:region:account:cluster/CLUSTER_NAME
            Matcher m = Pattern.compile("cluster/(.+)$").matcher(context);
            if (m.find()) {
                return m.group(1);
            }
            // If not ARN format, try listing EKS clusters
            String clusters = runCommand("aws", "eks", "list-clusters", "--region", region,
                    "--query", "clusters[0]", "--output", "text").trim();
            if (clusters != null && !clusters.isBlank() && !"None".equals(clusters)) {
                return clusters;
            }
        } catch (Exception e) {
            log.warn("Could not detect cluster from kubeconfig: {}", e.getMessage());
        }
        return "my-eks"; // fallback
    }

    public String getAccessKey() { return resolvedAccessKey; }
    public String getSecretKey() { return resolvedSecretKey; }
    public String getSessionToken() { return resolvedSessionToken; }
    public String getRegion() { return region; }
    public String getClusterName() { return clusterName; }
    public boolean isRunningOnEc2() { return runningOnEc2; }

    private boolean detectEc2() {
        try {
            // EC2 instance metadata endpoint
            ProcessBuilder pb = new ProcessBuilder("curl", "-s", "--connect-timeout", "1",
                    "http://169.254.169.254/latest/meta-data/instance-id");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            int exit = p.waitFor();
            return exit == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private String runCommand(String... command) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String output;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            output = reader.lines().collect(Collectors.joining("\n"));
        }
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("Command failed (exit " + exitCode + "): " + output);
        }
        return output;
    }
}
