package de.prime_ux.backend.analyze;

import de.prime_ux.backend.run.RunResponse;
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

	public record AnalyzeRequest(@NotNull Long profileId, Integer days) {}

	private final AnalysisService analysis;

	public AnalysisController(AnalysisService analysis) {
		this.analysis = analysis;
	}

	/** Re-Analyse „Bestand gegen Profil X bewerten" — gedeckelt wie jeder Lauf. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RunResponse reanalyze(@Valid @RequestBody AnalyzeRequest request) {
		return RunResponse.from(analysis.reanalyze(request.profileId(), request.days()));
	}

	@GetMapping("/preview")
	public AnalysisPreview preview(@RequestParam Long profileId, @RequestParam(required = false) Integer days) {
		return analysis.preview(profileId, days);
	}

	@ExceptionHandler(ProfileNotFoundException.class)
	public ProblemDetail handleNotFound(ProfileNotFoundException e) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
	}
}
