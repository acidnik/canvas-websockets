function get_class(obj) {
    var cls = ""+obj.constructor;
    while (cls.match(/\n/)) {
        cls = cls.replace(/\n+/,'','g');
    }
    cls = cls.replace(/function\s+([^\(]+)\(.*/, "$1", "gs");
    return cls;
}
function extend(Child, Parent) {
    var F = function() { };
    F.prototype = Parent.prototype;
    Child.prototype = new F();
    Child.prototype.constructor = Child;
    Child.superclass = Parent.prototype;
}

// ************** Tool 
function Tool(canvas, socket, opt) {
    this.c = canvas;
    this.color = '#000000'; // TODO
    this.ctx = this.c[0].getContext('2d');
    this.drawing = false;
    this.width = this.c.width();
    this.height = this.c.height();
    this.socket = socket;
    return this;
}

Tool.prototype.draw_points = function(points) {
}

Tool.prototype.begin = function (x,y) {
    this.drawing = true;
}

Tool.prototype.end = function() {
    this.drawing = false;
    var command = this.command();
    command.tool = get_class(this);
    console.log(['send:', JSON.stringify(command)]);
    this.socket.send(JSON.stringify(command));
}

Tool.prototype.move = function(x,y) {
    if (!this.drawing) {
        return true;
    }
}
Tool.prototype.command = function() {
    return {};
}

// ********** Pencil
function Pencil(canvas) {
    Pencil.superclass.constructor.apply(this, arguments);
};
extend(Pencil, Tool);
Pencil.prototype.begin = function(x,y) {
    Pencil.superclass.begin.call(this,x,y);
    this.lastx = x;
    this.lasty = y;
    this.points = [ [x,y] ];
}
Pencil.prototype.move = function(x,y) {
    if (!this.drawing) return true;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastx, this.lasty);
    this.ctx.lineTo(x,y);
    this.ctx.stroke();
    this.lastx = x;
    this.lasty = y;
    this.points.push([x,y]);
    return true;
}
Pencil.prototype.command = function() {
    return {
        points: this.points
    };
}
Pencil.prototype.draw_points = function(points) {
    var i = points.length-1;
    this.ctx.beginPath();
    while (i--) {
        this.ctx.moveTo(points[i+1][0], points[i+1][1]);
        this.ctx.lineTo(points[i][0], points[i][1]);
    }
    this.ctx.stroke();
}

// ************ Line
function Line(canvas) {
    Line.superclass.constructor.apply(this, arguments);
}
extend(Line, Tool);
Line.prototype.begin = function(x,y) {
    Line.superclass.begin.call(this,x,y);
    this.startx = x;
    this.starty = y;
    this.base = this.ctx.getImageData(0,0,this.width, this.height);
    this.points = [ [x,y] ];
}
Line.prototype.move = function(x,y) {
    if (!this.drawing) return true;
    this.lastx = x;
    this.lasty = y;
    this.ctx.beginPath();
    this.ctx.putImageData(this.base, 0,0);
    this.ctx.moveTo(x,y);
    this.ctx.lineTo(this.startx, this.starty);
    this.ctx.stroke();
}
Line.prototype.end = function(x,y) {
    this.ctx.beginPath();
    this.ctx.moveTo(this.startx, this.starty);
    this.ctx.lineTo(x,y);
    this.ctx.stroke();
    this.points.push( [x,y] );
    Line.superclass.end.call(this,x,y);
}
Line.prototype.command = function() {
    return {
        points: this.points
    };
}
Line.prototype.draw_points = function(points) {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    this.ctx.lineTo(points[1][0], points[1][1]);
    this.ctx.stroke();
}

// *********** Clear
function Clear() {
    Clear.superclass.constructor.apply(this, arguments);
    this.ctx.clearRect(0,0,this.width, this.height);
}
extend(Clear, Tool)
Clear.prototype.draw_points = function() {
    this.ctx.clearRect(0,0,this.width, this.height);
}

// **************** Board
function Board(element) {
    this.el = $(element);
    this.ctx = this.el[0].getContext('2d');
    this.initSocket();
    this.initMouseEvents();
}

Board.prototype.initMouseEvents = function() {
    var _this = this;
    this.el.mousedown(function(e) {
        var x = e.pageX - this.offsetLeft,
            y = e.pageY - this.offsetTop;
        if (typeof _this.tool !== "undefined") _this.tool.begin(x,y);
        return false;
    });
    this.el.mousemove(function(e) {
        var x = e.pageX - this.offsetLeft,
            y = e.pageY - this.offsetTop;
        if (typeof _this.tool !== "undefined") _this.tool.move(x,y);
        return false;
    });
    this.el.mouseup(function(e) {
        var x = e.pageX - this.offsetLeft,
            y = e.pageY - this.offsetTop;
        if (typeof _this.tool !== "undefined")  _this.tool.end(x,y);
        return false;
    });
}

Board.prototype.initSocket = function() {
    var _this = this;
    this.socket = new WebSocket('ws://localhost:3000/d');
    this.socket.onopen = function (){
        console.log("websocket connected");
        _this.setTool(Line, this);
    };
    this.socket.oncolose = function(){
        console.log("websocket closed");
    };
    this.socket.onmessage = function(msg){
        console.log(msg.data);
        var data = $.parseJSON(msg.data);
        if (typeof(data.tool) !== "undefined") {
            var tool = new window[data.tool](_this.el, _this.socket);
            tool.draw_points(data.points);
        }
    };
}

Board.prototype.setTool = function(tool) {
    this.tool = new tool(this.el, this.socket);
    console.log([ 'set tool', tool ]);
}
