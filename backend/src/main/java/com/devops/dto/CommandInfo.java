package com.devops.dto;

import java.util.List;

public class CommandInfo {
    private String key;
    private String template;
    private List<String> parameters;

    public CommandInfo() {}

    public CommandInfo(String key, String template, List<String> parameters) {
        this.key = key;
        this.template = template;
        this.parameters = parameters;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }

    public List<String> getParameters() { return parameters; }
    public void setParameters(List<String> parameters) { this.parameters = parameters; }
}
