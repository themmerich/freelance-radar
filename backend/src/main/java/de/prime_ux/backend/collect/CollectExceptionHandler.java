package de.prime_ux.backend.collect;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class CollectExceptionHandler {

	/** IMAP nicht erreichbar/Login fehlgeschlagen → 502, damit das Dashboard es anzeigen kann. */
	@ExceptionHandler(MailFetchException.class)
	public ProblemDetail handleMailFetch(MailFetchException e) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, e.getMessage());
	}
}
