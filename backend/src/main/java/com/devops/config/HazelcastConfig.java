package com.devops.config;

import com.hazelcast.config.Config;
import com.hazelcast.config.MapConfig;
import com.hazelcast.core.Hazelcast;
import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.spring.cache.HazelcastCacheManager;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class HazelcastConfig {

    @Bean
    public HazelcastInstance hazelcastInstance() {
        Config config = new Config();
        config.setInstanceName("devops-cache");
        config.getNetworkConfig().getJoin().getAutoDetectionConfig().setEnabled(false);
        config.getNetworkConfig().getJoin().getMulticastConfig().setEnabled(false);

        config.addMapConfig(new MapConfig("clusterStatus").setTimeToLiveSeconds(15));
        config.addMapConfig(new MapConfig("executionHistory").setTimeToLiveSeconds(10));
        config.addMapConfig(new MapConfig("availableCommands").setTimeToLiveSeconds(300));
        config.addMapConfig(new MapConfig("resourceNames").setTimeToLiveSeconds(20));
        config.addMapConfig(new MapConfig("eventsCache").setTimeToLiveSeconds(300));

        return Hazelcast.getOrCreateHazelcastInstance(config);
    }

    @Bean
    public CacheManager cacheManager(HazelcastInstance hazelcastInstance) {
        return new HazelcastCacheManager(hazelcastInstance);
    }
}
