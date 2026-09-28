shader_type canvas_item;
// Pós-processamento "bodycam": lente levemente abaulada (barril),
// aberração cromática nas bordas, vinheta, dessaturação e granulação.
// Valores controlados por GameConfig (seção CÂMERA / pós-processamento).

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform float distortion = 0.1;
uniform float vignette = 0.45;
uniform float grain = 0.035;
uniform float chromatic = 0.0015;
uniform float saturation = 0.82;

float rand(vec2 co) {
	return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 c = SCREEN_UV - 0.5;
	float r2 = dot(c, c);
	// Distorção de barril, normalizada para não mostrar bordas pretas.
	vec2 uv = 0.5 + c * (1.0 + distortion * r2) / (1.0 + distortion * 0.5);
	vec2 ca = c * chromatic * (1.0 + r2 * 8.0);
	vec3 col;
	col.r = texture(screen_tex, uv + ca).r;
	col.g = texture(screen_tex, uv).g;
	col.b = texture(screen_tex, uv - ca).b;
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(vec3(lum), col, saturation);
	col *= 1.0 - vignette * smoothstep(0.08, 0.55, r2 * 1.6);
	float n = rand(SCREEN_UV * vec2(1931.0, 1117.0) + fract(TIME * 7.13)) - 0.5;
	col += n * grain;
	COLOR = vec4(col, 1.0);
}
