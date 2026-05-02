package com.devops.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "command_execution", schema = "aws", indexes = {
    @Index(name = "idx_command_name", columnList = "command_name"),
    @Index(name = "idx_executed_at", columnList = "executed_at DESC"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_command_status", columnList = "command_name, status")
})
public class CommandExecution implements java.io.Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "command_name", nullable = false)
    private String commandName;

    @Column(name = "full_command", nullable = false, length = 1000)
    private String fullCommand;

    @Column(columnDefinition = "TEXT")
    private String output;

    @Column(nullable = false)
    private String status;

    @Column(name = "executed_at", nullable = false)
    private LocalDateTime executedAt;

    public CommandExecution() {}

    public CommandExecution(Long id, String commandName, String fullCommand,
                            String output, String status, LocalDateTime executedAt) {
        this.id = id;
        this.commandName = commandName;
        this.fullCommand = fullCommand;
        this.output = output;
        this.status = status;
        this.executedAt = executedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCommandName() { return commandName; }
    public void setCommandName(String commandName) { this.commandName = commandName; }

    public String getFullCommand() { return fullCommand; }
    public void setFullCommand(String fullCommand) { this.fullCommand = fullCommand; }

    public String getOutput() { return output; }
    public void setOutput(String output) { this.output = output; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }
}
