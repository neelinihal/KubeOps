package com.devops.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "k8s_cache", schema = "aws", indexes = {
    @Index(name = "idx_cache_key", columnList = "cache_key", unique = true)
})
public class K8sCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cache_key", nullable = false, unique = true)
    private String cacheKey;

    @Column(name = "data", columnDefinition = "TEXT", nullable = false)
    private String data;

    @Column(name = "fetched_at", nullable = false)
    private LocalDateTime fetchedAt;

    public K8sCache() {}

    public K8sCache(String cacheKey, String data) {
        this.cacheKey = cacheKey;
        this.data = data;
        this.fetchedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCacheKey() { return cacheKey; }
    public void setCacheKey(String cacheKey) { this.cacheKey = cacheKey; }

    public String getData() { return data; }
    public void setData(String data) { this.data = data; }

    public LocalDateTime getFetchedAt() { return fetchedAt; }
    public void setFetchedAt(LocalDateTime fetchedAt) { this.fetchedAt = fetchedAt; }
}
