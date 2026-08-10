package de.prime_ux.backend.collect;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Holt Projektseiten per HTTP.
 *
 * Die in der Mail verlinkte URL trägt Tracking-Parameter (utm_*, agent, t) — die werden vor
 * dem Abruf entfernt, damit dieselbe Seite nicht unter verschiedenen Adressen erscheint. Die
 * bereinigte `…/nproj/<id>.html` antwortet mit 301 auf die sprechende `…/projekt/<slug>`,
 * deshalb folgt der Client Weiterleitungen.
 */
@Service
public class HttpPageSource implements PageSource {

	private static final Logger log = LoggerFactory.getLogger(HttpPageSource.class);

	private final HttpClient client;
	private final DetailProperties properties;

	public HttpPageSource(DetailProperties properties) {
		this.properties = properties;
		this.client = HttpClient.newBuilder()
			.followRedirects(HttpClient.Redirect.NORMAL)
			.connectTimeout(Duration.ofMillis(properties.timeoutMs()))
			.build();
	}

	@Override
	public PageResult fetch(String url) {
		URI uri;
		try {
			uri = URI.create(stripTracking(url));
		} catch (IllegalArgumentException e) {
			return new PageResult.Failed("Unlesbare URL: " + url);
		}

		HttpRequest request = HttpRequest.newBuilder(uri)
			.header("User-Agent", properties.userAgent())
			.header("Accept", "text/html")
			.timeout(Duration.ofMillis(properties.timeoutMs()))
			.GET()
			.build();

		try {
			HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
			int status = response.statusCode();
			if (status == 200) {
				return new PageResult.Html(response.body());
			}
			if (status == 404 || status == 410) {
				return new PageResult.Gone();
			}
			return new PageResult.Failed("HTTP " + status);
		} catch (IOException e) {
			log.debug("Detailseite {} nicht erreichbar: {}", uri, e.getMessage());
			return new PageResult.Failed(e.getMessage());
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			return new PageResult.Failed("Abbruch");
		}
	}

	/** Entfernt Query und Fragment — der Pfad allein identifiziert das Projekt. */
	static String stripTracking(String url) {
		int cut = url.indexOf('?');
		String withoutQuery = cut < 0 ? url : url.substring(0, cut);
		int hash = withoutQuery.indexOf('#');
		return hash < 0 ? withoutQuery : withoutQuery.substring(0, hash);
	}
}
