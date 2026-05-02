package com.devops.repository;

import com.devops.model.K8sEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface K8sEventRepository extends JpaRepository<K8sEvent, Long> {
    List<K8sEvent> findAllByOrderByLastSeenDesc();
    List<K8sEvent> findByNamespaceOrderByLastSeenDesc(String namespace);

    @Modifying
    @Query("DELETE FROM K8sEvent e WHERE e.fetchedAt < :cutoff")
    void deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);

    List<K8sEvent> findByNamespaceAndReasonAndObjectAndMessage(String namespace, String reason, String object, String message);
}
