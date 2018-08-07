const TURN_L = 0,
      TURN_R = 1,
      MOVE_F = 2,
      SENSE = 3,
      LABEL = 4,
      PREV_LT = 5,
      NEXT_LT = 6;

export default class FoodBot {
  constructor(foodGrid) {
  	// initiate fields
    this.foodGrid = foodGrid;
  	this.text = [];
  	this.volatility = undefined;
  	this.pc = 0;
  	this.mem = {a: 0, b: 0};
  	this.dir = 0;
  	this.pos = {
  		x: Math.floor(this.foodGrid.width * Math.random()),
  		y: Math.floor(this.foodGrid.height * Math.random())
  	};
  	this.life = FoodBot.LIFETIME;
  	this.food = 0;
  }

	// load random code
	init() {
		while(this.text.length < 256) {
			this.text.push(Math.floor(7 * Math.random()));
		}
	}

  draw(ctx, color) {
		const botX = (this.pos.x + 0.15) * ctx.canvas.width / this.grid.width;
		const botY = (this.pos.y + 0.15) * ctx.canvas.height / this.grid.height;
		const botW = 0.7 * ctx.canvas.width / this.grid.width;
		const botH = 0.7 * ctx.canvas.height / this.grid.height;

		ctx.strokeStyle = color;
		ctx.strokeRect(botX, botY, botW, botH);

		// draw eye
		const cx = botX + botW / 2;
		const cy = botY + botH / 2;
		const eyeW = botW / 2;
		const eyeH = botH / 2;
		const eyeX = cx - eyeW / 2 + eyeW / 2 * (this.dir % 2 > 0 ? 0 : 1 - this.dir);
		const eyeY = cy - eyeH / 2 + eyeH / 2 * (this.dir % 2 > 0 ? this.dir - 2 : 0);

		ctx.fillStyle = !this.isDead() ? '#ff0000' : '#7f7f7f';
		ctx.fillRect(eyeX, eyeY, eyeW, eyeH);
  }

	// life of the bot
  run() {
		if(this.isDead()) {
			console.log('already dead');
			return;
		}

		// perform action
		switch(this.text[this.pc]) {
			case TURN_L:
			this.dir = mod(this.dir + 1, 4);
			break;

			case TURN_R:
			this.dir = mod(this.dir - 1, 4);
			break;

			case MOVE_F:
      const [h, k] = moveForward(this.dir);
			this.pos.x = mod(this.pos.x + h, this.foodGrid.width);
			this.pos.y = mod(this.pos.y + k, this.foodGrid.height);
			if(this.foodGrid.get(this.pos.x, this.pos.y)) {
				this.food++;
				this.foodGrid.set(this.pos.x, this.pos.y, false);
			}
			break;

			case SENSE:
			this.mem.b = this.mem.a;
			this.mem.a = this.sense();
			break;

			case LABEL:
			// nop
			break;

			case PREV_LT:	// prev if a<b
			if(this.mem.a >= this.mem.b) break;
			while(this.pc >= 0) {
				if(this.text[this.pc] == LABEL) {
					break;
				}
				this.pc--;
			}
			break;

			case NEXT_LT:	// next if a<b
			if(this.mem.a >= this.mem.b) break;
			while(this.pc < this.text.length) {
				if(this.text[this.pc] == 4) {
					break;
				}
				this.pc++;
			}
			break;

			default: console.log('Invalid code:', this.text[this.pc]);
		}

		if(this.pc == this.text.length) {
			this.life = 0; // halt
		} else {
			this.pc++;
			this.life--;
		}
	}

	// can the bot not run any longer?
	isDead() {
		return this.life <= 0 || this.pc >= this.text.length;
	}

	// give feedback to the bot for finding food in line of sight
	sense() {
		let x = this.pos.x;
		let y = this.pos.y;
		let dist = 0;
		let found = false;
    const [h, k] = moveForward(this.dir);

		// look down the bot's line of sight for the closest food
		do {
			x = mod(x + h, this.foodGrid.width);
			y = mod(y + k, this.foodGrid.height);
			dist++;

			if(this.foodGrid.get(x, y)) {
				found = true;
				break;
			}
		} while(x != this.pos.x && y != this.pos.y);

		// return distance to food, or 0 if not found
		return found ? dist : 0;
	}

	// the fitness function
	getFitness() {
		return this.food;
	}

	// reproduction, mixing of genes to produce offspring
	crossover(bot) {
		// change to model meiosis
		const child = new FoodBot(this.foodGrid);
		const myFit = this.getFitness();
		const botFit = bot.getFitness();
		const sum = myFit + botFit || 1;

		child.volatility = (this.volatility * myFit + bot.volatility * botFit) / sum;
		for(let i = 0; i < this.text.length; i++) {
      const parent = Math.random() < 0.5 ? this : bot;
			child.text.push(parent.text[i]);
		}
		return child;
	}

	// add more diversity to the gene pool
	mutate(rate) {
		const chance = rate / 2 + rate * this.volatility;
		for(let i = 0; i < this.text.length; i++) {
			if(Math.random() < chance) {
				this.text[i] = Math.floor(7 * Math.random());
			}
		}
	}

	// prettify my own tags
	toHTML() {
		const commands = [
			{type: 'move', name: 'TURN_L'},
			{type: 'move', name: 'TURN_R'},
			{type: 'move', name: 'MOVE_F'},
			{type: 'sensor', name: 'SENSE'},
			{type: 'label', name: 'LABEL'},
			{type: 'jump', name: 'PREV_LT'},
			{type: 'jump', name: 'NEXT_LT'}
		];
    return this.text
      .map(x => commands[x])
      .map(x => `<span data-code="${x.type}">${x.name}</span>`)
      .join(', ');
	}
}
FoodBot.LIFETIME = 512;

function mod(a, b) {
  return (a % b + b) % b;
}

function moveForward(dir) {
  const dirMap = [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1]
  ];
  return dirMap[dir];
}
