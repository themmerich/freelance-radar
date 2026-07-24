package de.prime_ux.backend.analyze;

import de.prime_ux.backend.run.RunRepository;
import de.prime_ux.backend.run.RunResponse;
import de.prime_ux.backend.run.TokenTotals;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import de.prime_ux.backend.profile.ProfileNotFoundException;

@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {

	/** Konservative Defaults, solange noch kein Lauf mit Analysen protokolliert ist. */
	private static final long FALLBACK_INPUT_TOKENS_PER_OFFER = 800;
	private static final long FALLBACK_OUTPUT_TOKENS_PER_OFFER = 170;

	public record AnalyzeRequest(@NotNull Long profileId, Integer days) {}

	public record AnalysisPreview(int candidates, long estimatedInputTokens, long estimatedOutputTokens) {}

	private final AnalysisService analysis;
	private final RunRepository runs;

	public AnalysisController(AnalysisService analysis, RunRepository runs) {
		this.analysis = analysis;
		this.runs = runs;
	}

	/** Re-Analyse „Bestand gegen Profil X bewerten" — gedeckelt wie jeder Lauf. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RunResponse reanalyze(@Valid @RequestBody AnalyzeRequest request) {
		return RunResponse.from(analysis.reanalyze(request.profileId(), request.days()));
	}

	/** Kostenvorschau: Kandidaten × Ø-Tokens der bisherigen Läufe. */
	@GetMapping("/preview")
	public AnalysisPreview preview(@RequestParam Long profileId, @RequestParam(required = false) Integer days) {
		int candidates = analysis.countCandidates(profileId, days);
		TokenTotals totals = runs.tokenTotals();
		long inputPerOffer = totals.analyzedOffers() > 0 ? totals.inputTokens() / totals.analyzedOffers() : FALLBACK_INPUT_TOKENS_PER_OFFER;
		long outputPerOffer = totals.analyzedOffers() > 0
			? totals.outputTokens() / totals.analyzedOffers()
			: FALLBACK_OUTPUT_TOKENS_PER_OFFER;
		return new AnalysisPreview(candidates, candidates * inputPerOffer, candidates * outputPerOffer);
	}

	@ExceptionHandler(ProfileNotFoundException.class)
	public ProblemDetail handleNotFound(ProfileNotFoundException e) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
	}
}
