export default class Grid{
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.data = new Array(width * height);
	}

	get(x, y) {
		if(x < 0 || x >= this.width || y < 0 || y >= this.height) return;
		return this.data[x + y * this.width];
	}

	set(x, y, val) {
		if(x < 0 || x >= this.width || y < 0 || y >= this.height) return;
		this.data[x + y * this.width] = val;
	}

	fill(val) {
		this.data.fill(val);
	}
}
