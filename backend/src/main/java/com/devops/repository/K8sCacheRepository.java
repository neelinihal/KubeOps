package com.devops.repository;

import com.devops.model.K8sCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface K8sCacheRepository extends JpaRepository<K8sCache, Long> {
    Optional<K8sCache> findByCacheKey(String cacheKey);
}
