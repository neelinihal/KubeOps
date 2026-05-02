package com.devops.model;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "k8s_event", schema = "aws", indexes = {
    @Index(name = "idx_event_namespace", columnList = "namespace"),
    @Index(name = "idx_event_type", columnList = "type"),
    @Index(name = "idx_event_fetched_at", columnList = "fetched_at DESC")
})
public class K8sEvent implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String namespace;

    @Column(name = "last_seen")
    private String lastSeen;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String reason;

    @Column(nullable = false)
    private String object;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    public K8sEvent() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNamespace() { return namespace; }
    public void setNamespace(String namespace) { this.namespace = namespace; }

    public String getLastSeen() { return lastSeen; }
    public void setLastSeen(String lastSeen) { this.lastSeen = lastSeen; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getObject() { return object; }
    public void setObject(String object) { this.object = object; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getFetchedAt() { return fetchedAt; }
    public void setFetchedAt(LocalDateTime fetchedAt) { this.fetchedAt = fetchedAt; }
}
