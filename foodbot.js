"use strict";

var canvas, ctx, lastDraw, lastTick, drawId, tickId, grid, population, genCount, foodEaten, MAX_FIT;
var TPS = 60;
var FOOD_PER_BOT = 10;
var POP_SIZE = 50;
var MUTATE_RATE = 0.001;

window.addEventListener("load", init);

function init() {
	canvas = document.querySelector("canvas");
	canvas.width = 1024;
	canvas.height = 768;
	ctx = canvas.getContext("2d");

	//initiate values
	genCount = 0;
	foodEaten = 0;

	// initiate grid
	grid = new Grid(100, 75);
	grid.fill(false);
	var n = FOOD_PER_BOT * POP_SIZE;
	while(n > 0) {
		var x = Math.floor(grid.width * Math.random());
		var y = Math.floor(grid.height * Math.random());
		if(!grid.get(x, y)) {
			grid.set(x, y, true);
			n--;
		}
	}

	MAX_FIT = FOOD_PER_BOT * POP_SIZE / (grid.width * grid.height) * FoodBot.LIFETIME;

	// initiate population
	population = [];
	for(var i = 0; i < POP_SIZE; i++) {
		var bot = new FoodBot();
		bot.init();
		population.push(bot);
	}

	// begin evolution
	lastDraw = Date.now();
	drawId = requestAnimationFrame(draw);
	lastTick = Date.now();
	tickId = setTimeout(tick, 1000 / TPS);
}

function draw() {
	var currentDraw = Date.now();
	var dt = (currentDraw - lastDraw) / 1000;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// draw the grid
	ctx.strokeStyle = "#bfbfbf";
	ctx.lineWidth = 1;
	ctx.beginPath();
	for(var x = 0; x < grid.width; x++) {
		// horizontal lines
		ctx.moveTo(x / grid.width * canvas.width, 0);
		ctx.lineTo(x / grid.width * canvas.width, canvas.height);
	}
	for(var y = 0; y < grid.width; y++) {
		// vertical lines
		ctx.moveTo(0 , y / grid.height * canvas.height);
		ctx.lineTo(canvas.width, y / grid.height * canvas.height);
	}
	ctx.stroke();

	// draw the food
	ctx.fillStyle = "#007fff";
	for(var x = 0; x < grid.width; x++) {
		for(var y = 0; y < grid.height; y++) {
			// found a food item
			if(grid.get(x,y)) {
				var foodX = (x + 0.5) * canvas.width / grid.width;
				var foodY = (y + 0.5) * canvas.height / grid.height;
				var foodW = 0.4 * canvas.width / grid.width;
				var foodH = 0.4 * canvas.height / grid.height;
				var foodR = Math.min(foodW, foodH) / 2;

				ctx.beginPath();
				ctx.arc(foodX, foodY, foodR, 0, 2 * Math.PI);
				ctx.fill();
			}
		}
	}

	// draw the food bots
	ctx.fillStyle = "#ff0000";
	ctx.strokeStyle = "#3f3f3f";
	ctx.lineWidth = 2;
	for(var i = 0; i < POP_SIZE; i++) {
		// draw body
		var bot = population[i];
		var botX = (bot.pos.x + 0.15) * canvas.width / grid.width;
		var botY = (bot.pos.y + 0.15) * canvas.height / grid.height;
		var botW = 0.7 * canvas.width / grid.width;
		var botH = 0.7 * canvas.height / grid.height;
		ctx.strokeRect(botX, botY, botW, botH);

		// draw eye
		ctx.fillStyle = !bot.isDead() ? "#ff0000" : "#7f7f7f";
		var cx = botX + botW / 2;
		var cy = botY + botH / 2;
		var eyeW = botW / 2;
		var eyeH = botH / 2;
		var eyeX = cx - eyeW / 2 + eyeW / 2 * (bot.dir % 2 > 0 ? 0 : 1 - bot.dir);
		var eyeY = cy - eyeH / 2 + eyeH / 2 * (bot.dir % 2 > 0 ? bot.dir - 2 : 0);
		ctx.fillRect(eyeX, eyeY, eyeW, eyeH);
	}

	lastDraw = currentDraw;
	drawId = requestAnimationFrame(draw);
}

function tick() {
	var currentTick = Date.now();
	var dt = (currentTick - lastTick) / 1000;

	// live life
	var genRunning = false;
	for(var i = 0; i < POP_SIZE; i++) {
		var bot = population[i];
		// let all bots run as long as they can in the timeframe given
		if(!bot.isDead()) {
			bot.run();
			genRunning = true;
		}
	}

	document.getElementById("eaten").textContent = Math.floor(100 * foodEaten / (FOOD_PER_BOT * POP_SIZE)) + "%";

	// generation over
	if(!genRunning) {
		generate();
	}

	lastTick = currentTick;
	tickId = setTimeout(tick, 1000 / TPS);
}

function generate() {
	var nextGen = [];
	var mateChances = [];
	var bestFit = 0;
	var bestFitBot = null;
	genCount++;

	// calculate best food bot
	for(var i = 0; i < POP_SIZE; i++) {
		var bot = population[i];
		var botFit = bot.getFitness() / MAX_FIT;
		if(bestFitBot == null || botFit > bestFit) {
			bestFit = botFit;
			bestFitBot = bot;
		}
		mateChances.push(botFit);
	}

	// update stats
	document.getElementById("food-bot").innerHTML = bestFitBot.toHTML();
	document.getElementById("fitness").textContent = Math.floor(100 * bestFit) + "%";
	document.getElementById("generation").textContent = genCount;
	foodEaten = 0;

	// create next generation of food bots
	var nextGen = [];
	for(var i = 0; i < POP_SIZE; i++) {
		var parent1 = population[simulate(mateChances)];
		var parent2 = population[simulate(mateChances)];
		var child = parent1.crossover(parent2);
		child.mutate(MUTATE_RATE);
		nextGen.push(child);
	}

	// reset grid
	grid.fill(false);
	var n = FOOD_PER_BOT * POP_SIZE;
	while(n > 0) {
		var x = Math.floor(grid.width * Math.random());
		var y = Math.floor(grid.height * Math.random());
		if(!grid.get(x, y)) {
			grid.set(x, y, true);
			n--;
		}
	}

	population = nextGen;
}

// accepts an array of positive values indicating likelihood
// returns an index probabilistically chosen
function simulate(chances) {
	var sum = 0;
	for(var i = 0; i < chances.length; i++) {
		sum += chances[i];
	}
	if(sum == 0) {
		return Math.floor(Math.random() * chances.length);
	}
	var rand = Math.random();
	var chance = 0;
	for(var i = 0; i < chances.length; i++) {
		chance += chances[i] / sum;
		if(rand < chance) {
			return i;
		}
	}
	return -1;
}

function FoodBot(v) {
	// initiate fields
	this.text = [];
	this.volitility = v;
	this.pc = 0;
	this.mem = {a: 0, b: 0};
	this.dir = 0;
	this.pos = {
		x: Math.floor(grid.width * Math.random()),
		y: Math.floor(grid.height * Math.random())
	};
	this.life = FoodBot.LIFETIME;
	this.food = 0;

	// load random code
	this.init = function() {
		while(this.text.length < 256) {
			this.text.push(Math.floor(7 * Math.random()));
		}
	};

	// life of the bot
	this.run = function() {
		if(this.isDead()) {
			console.log("already dead");
			return;
		}

		// perform action
		switch(this.text[this.pc]) {
			case 0:	// left
				this.dir = (this.dir + 1) % 4;
				break;
			case 1:	// right
				this.dir = (this.dir + 3) % 4;
				break;
			case 2:	// forward
				this.pos.x = (this.pos.x + (this.dir % 2 > 0 ? 0 : 1 - this.dir) + grid.width) % grid.width;
				this.pos.y = (this.pos.y + (this.dir % 2 > 0 ? this.dir - 2 : 0) + grid.height) % grid.height;
				if(grid.get(this.pos.x, this.pos.y)) {
					this.food++;
					foodEaten++;
					grid.set(this.pos.x, this.pos.y, false);
				}
				break;
			case 3:	// sensor
				this.mem.b = this.mem.a;
				this.mem.a = this.sense();
				break;
			case 4:	// marks label
				// nop
				break;
			case 5:	// prev if a<b
				if(this.mem.a < this.mem.b) {
					while(this.pc >= 0) {
						if(this.text[this.pc] == 4) {
							break;
						}
						this.pc--;
					}
				}
				break;
			case 6:	// next if a<b
				if(this.mem.a < this.mem.b) {
					while(this.pc < this.text.length) {
						if(this.text[this.pc] == 4) {
							break;
						}
						this.pc++;
					}
				}
				break;
			default:
				console.log("Invalid code:", this.text[this.pc]);
		}

		if(this.pc == this.text.length) {
			// halt
			this.life = 0;
		} else {
			this.pc++;
			this.life--;
		}
	};

	// can the bot run longer?
	this.isDead = function() {
		return this.life <= 0 || this.pc >= this.text.length;
	};

	// give feedback to the bot for finding food in line of sight
	this.sense = function() {
		var h = 0;
		var k = 0;
		var dist = 0;
		var found = false;
		// look down the bot's field of view for the closest food
		while(this.pos.x + h >= 0 && this.pos.x + h < grid.width && this.pos.y + k >= 0 && this.pos.y + k < grid.height) {
			h += this.dir % 2 > 0 ? 0 : 1 - this.dir;
			k += this.dir % 2 > 0 ? this.dir - 2 : 0;
			dist++;
			if(grid.get(this.pos.x + h, this.pos.y + k)) {
				found = true;
				break;
			}
		}
		// return distance to food, or 0 if not found
		return found ? dist : 0;
	};

	// the fitness function
	this.getFitness = function() {
		return this.food;
	};

	// reproduction, mixing of genes to produce offspring
	this.crossover = function(bot) {
		// change to model meiosis
		var child = new FoodBot();
		var myFit = this.getFitness();
		var botFit = bot.getFitness();
		var sum = myFit > 0 || botFit > 0 ? myFit + botFit : 1;
		child.volitility = (this.volitility * myFit + bot.volitility * botFit) / sum;
		for(var i = 0; i < this.text.length; i++) {
			if(Math.random() < 0.5) {
				child.text.push(this.text[i]);
			} else {
				child.text.push(bot.text[i]);
			}
		}
		return child;
	};

	// add more diversity to the gene pool
	this.mutate = function(rate) {
		var chance = rate / 2 + rate * this.volatility;
		for(var i = 0; i < this.text.length; i++) {
			if(Math.random() < chance) {
				this.text[i] = Math.floor(7 * Math.random());
			}
		}
	};

	// prettify my own tags
	this.toHTML = function() {
		var commands = [
			{type: "move", name: "TURN_L"},
			{type: "move", name: "TURN_R"},
			{type: "move", name: "MOVE_F"},
			{type: "sensor", name: "SENSE"},
			{type: "label", name: "LABEL"},
			{type: "jump", name: "PREV_LT"},
			{type: "jump", name: "NEXT_LT"}
		];
		var program = "";
		for(var i = 0; i < this.text.length; i++) {
			var command = commands[this.text[i]];
			program += "<span data-code=\"" + command.type + "\">" + command.name + "</span>";
			if(i != this.text.length - 1) {
				program += ", ";
			}
		}
		return program;
	};
}
FoodBot.LIFETIME = 512;

// an object that holds data in cells
function Grid(w, h) {
	this.width = w;
	this.height = h;
	this.data = new Array(w * h);

	this.get = function(x, y) {
		return this.data[x + y * this.width];
	};
	
	this.set = function(x, y, val) {
		this.data[x + y * this.width] = val;
	};

	this.fill = function(val) {
		for(var i = 0; i < this.data.length; i++) {
			this.data[i] = val;
		}
	};
}
