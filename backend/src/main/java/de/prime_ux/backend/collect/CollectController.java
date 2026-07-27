package de.prime_ux.backend.collect;

import de.prime_ux.backend.run.RunRepository;
import de.prime_ux.backend.run.RunResponse;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runs")
public class CollectController {

	private final CollectService collect;
	private final RunRepository runs;

	public CollectController(CollectService collect, RunRepository runs) {
		this.collect = collect;
		this.runs = runs;
	}

	/** Löst einen Abruf-Lauf aus (der „Mails abrufen"-Button im Dashboard). */
	@PostMapping
	public ResponseEntity<RunResponse> trigger() {
		RunResponse run = RunResponse.from(collect.collect());
		return ResponseEntity.created(URI.create("/api/runs/" + run.id())).body(run);
	}

	@GetMapping("/latest")
	public ResponseEntity<RunResponse> latest() {
		return runs
			.findTopByOrderByRanAtDesc()
			.map(run -> ResponseEntity.ok(RunResponse.from(run)))
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	/** Für die Kostenübersicht: alle Läufe, neueste zuerst. */
	@GetMapping
	public List<RunResponse> all() {
		return runs.findAllByOrderByRanAtDesc().stream().map(RunResponse::from).toList();
	}
}
