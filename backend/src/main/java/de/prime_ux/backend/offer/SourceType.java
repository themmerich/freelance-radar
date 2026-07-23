package de.prime_ux.backend.offer;

/** Über welchen Kanal die Mail hereinkam — Suchagent, private Anfrage oder Rauschen. */
public enum SourceType {
	AGENT,
	PRIVATE,
	NEWSLETTER,
	OTHER,
}
