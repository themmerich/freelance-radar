package de.prime_ux.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// Dummy-Key, damit die Spring-AI-Autokonfiguration ohne echte Secrets startet.
@SpringBootTest(properties = "spring.ai.anthropic.api-key=test-key")
@Import(TestcontainersConfiguration.class)
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
