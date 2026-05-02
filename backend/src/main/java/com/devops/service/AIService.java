package com.devops.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class AIService {

    private static final String NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

    private final RestTemplate restTemplate;

    @Value("${nvidia.api.key}")
    private String apiKey;

    public AIService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String generate(String message) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> body = Map.of(
            "model", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "messages", List.of(Map.of("role", "user", "content", message)),
            "temperature", 0.6,
            "top_p", 0.95,
            "max_tokens", 65536,
            "stream", false
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<ChatResponse> response = restTemplate.postForEntity(NVIDIA_API_URL, request, ChatResponse.class);
            if (response.getBody() != null && response.getBody().getChoices() != null) {
                StringBuilder result = new StringBuilder();
                for (Choice choice : response.getBody().getChoices()) {
                    if (choice.getMessage() != null) {
                        if (choice.getMessage().getReasoningContent() != null) {
                            result.append(choice.getMessage().getReasoningContent());
                        }
                        if (choice.getMessage().getContent() != null) {
                            result.append(choice.getMessage().getContent());
                        }
                    }
                }
                return result.toString();
            }
            return "AI service did not return a response.";
        } catch (RestClientException e) {
            return "Error contacting AI API: " + e.getMessage();
        }
    }

    // --- Response DTOs ---

    public static class ChatResponse {
        @JsonProperty("choices")
        private List<Choice> choices;

        public List<Choice> getChoices() { return choices; }
        public void setChoices(List<Choice> choices) { this.choices = choices; }
    }

    public static class Choice {
        @JsonProperty("message")
        private Message message;

        public Message getMessage() { return message; }
        public void setMessage(Message message) { this.message = message; }
    }

    public static class Message {
        @JsonProperty("content")
        private String content;

        @JsonProperty("reasoning_content")
        private String reasoningContent;

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getReasoningContent() { return reasoningContent; }
        public void setReasoningContent(String reasoningContent) { this.reasoningContent = reasoningContent; }
    }
}
