package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HttpPageSourceTest {

	@Test
	void stripsTheTrackingParametersTheMailAppends() {
		String url = "https://www.freelancermap.de/nproj/3033440.html?utm_source=systemmail&agent=235929&t=1786285737&html=0";

		assertThat(HttpPageSource.stripTracking(url)).isEqualTo("https://www.freelancermap.de/nproj/3033440.html");
	}

	@Test
	void leavesACleanUrlAlone() {
		String url = "https://www.freelancermap.de/nproj/3033440.html";

		assertThat(HttpPageSource.stripTracking(url)).isEqualTo(url);
	}

	@Test
	void dropsAFragmentToo() {
		assertThat(HttpPageSource.stripTracking("https://example.org/p/1.html#beschreibung")).isEqualTo("https://example.org/p/1.html");
	}
}
