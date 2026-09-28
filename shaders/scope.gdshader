shader_type canvas_item;
// Luneta do rifle de precisão: preto fora do círculo + retículo.

uniform float radius = 0.44;

void fragment() {
	vec2 uv = SCREEN_UV - 0.5;
	uv.x *= SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x;
	float d = length(uv);
	float outside = smoothstep(radius - 0.004, radius, d);
	float edge = smoothstep(radius * 0.72, radius, d) * 0.55;
	float thin = 0.0012;
	float thick = 0.0045;
	float line = 0.0;
	if (abs(uv.x) < thin || abs(uv.y) < thin) {
		line = 0.9;
	}
	if (d > radius * 0.5 && (abs(uv.x) < thick || abs(uv.y) < thick)) {
		line = 1.0;
	}
	float a = max(max(outside, edge), line);
	COLOR = vec4(vec3(0.0), a);
}
