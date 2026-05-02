package com.devops.controller;

import com.devops.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/ai")
public class AIController {
    private final AIService aiService;

    @Autowired
    public AIController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/generate")
    public String generate(@RequestBody String message) {
        return aiService.generate(message);
    }
}
