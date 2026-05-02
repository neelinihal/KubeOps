package com.devops.repository;

import com.devops.model.CommandExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommandExecutionRepository extends JpaRepository<CommandExecution, Long> {
    List<CommandExecution> findAllByOrderByExecutedAtDesc();
}
