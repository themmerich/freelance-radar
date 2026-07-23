package de.prime_ux.backend.collect;

import java.time.Instant;

/** Eine abgerufene Mail, reduziert auf die Felder, die Parser und Persistenz brauchen. */
public record FetchedMail(String messageId, String fromAddr, String subject, Instant receivedAt, String body) {}
