// Hardware-Grade D3-Compatible Force Physics Simulation Engine

export function forceLink(links = []) {
  let _links = links;
  let _nodes = [];
  let _id = d => d.id;
  let _distance = () => 30;
  let _strength = () => 0.7;
  let _nodeMap = new Map();

  function force(alpha) {
    for (let i = 0; i < _links.length; i++) {
      const link = _links[i];
      const source = typeof link.source === 'object' ? link.source : _nodeMap.get(link.source);
      const target = typeof link.target === 'object' ? link.target : _nodeMap.get(link.target);
      if (!source || !target) continue;

      let dx = target.x + (target.vx || 0) - source.x - (source.vx || 0);
      let dy = target.y + (target.vy || 0) - source.y - (source.vy || 0);
      let l = Math.hypot(dx, dy) || 1e-6;

      const targetDist = typeof _distance === 'function' ? _distance(link) : _distance;
      const str = typeof _strength === 'function' ? _strength(link) : _strength;

      const delta = (l - targetDist) / l * alpha * str;
      const wSource = 0.5;
      const wTarget = 0.5;

      const fx = dx * delta;
      const fy = dy * delta;

      if (target.fx == null) {
        target.vx -= fx * wTarget;
        target.vy -= fy * wTarget;
      }
      if (source.fx == null) {
        source.vx += fx * wSource;
        source.vy += fy * wSource;
      }
    }
  }

  force.initialize = function(nodes) {
    _nodes = nodes;
    _nodeMap = new Map(_nodes.map(n => [_id(n), n]));
  };

  force.links = function(l) {
    if (!arguments.length) return _links;
    _links = l;
    force.initialize(_nodes);
    return force;
  };

  force.id = function(fn) {
    if (!arguments.length) return _id;
    _id = fn;
    return force;
  };

  force.distance = function(d) {
    if (!arguments.length) return _distance;
    _distance = typeof d === 'function' ? d : () => +d;
    return force;
  };

  force.strength = function(s) {
    if (!arguments.length) return _strength;
    _strength = typeof s === 'function' ? s : () => +s;
    return force;
  };

  return force;
}

export function forceManyBody() {
  let _nodes = [];
  let _strength = () => -30;
  let _distanceMax2 = 2200 * 2200;

  function force(alpha) {
    const n = _nodes.length;
    for (let i = 0; i < n; i++) {
      const a = _nodes[i];
      const strA = typeof _strength === 'function' ? _strength(a) : _strength;
      for (let j = i + 1; j < n; j++) {
        const b = _nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let l2 = dx * dx + dy * dy;

        if (l2 === 0) {
          dx = (Math.random() - 0.5) * 1e-3;
          dy = (Math.random() - 0.5) * 1e-3;
          l2 = dx * dx + dy * dy;
        }

        if (l2 < _distanceMax2) {
          const l = Math.sqrt(l2);
          const strB = typeof _strength === 'function' ? _strength(b) : _strength;
          const avgStr = (strA + strB) * 0.5;
          const w = (avgStr * alpha) / l2;

          if (a.fx == null) {
            a.vx += (dx / l) * w;
            a.vy += (dy / l) * w;
          }
          if (b.fx == null) {
            b.vx -= (dx / l) * w;
            b.vy -= (dy / l) * w;
          }
        }
      }
    }
  }

  force.initialize = function(nodes) {
    _nodes = nodes;
  };

  force.strength = function(s) {
    if (!arguments.length) return _strength;
    _strength = typeof s === 'function' ? s : () => +s;
    return force;
  };

  force.distanceMax = function(m) {
    if (!arguments.length) return Math.sqrt(_distanceMax2);
    _distanceMax2 = (+m) * (+m);
    return force;
  };

  return force;
}

export function forceCollide(radius) {
  let _nodes = [];
  let _radius = typeof radius === 'function' ? radius : () => +radius;
  let _iterations = 2;

  function force() {
    const n = _nodes.length;
    for (let k = 0; k < _iterations; k++) {
      for (let i = 0; i < n; i++) {
        const a = _nodes[i];
        const rA = typeof _radius === 'function' ? _radius(a) : _radius;
        for (let j = i + 1; j < n; j++) {
          const b = _nodes[j];
          const rB = typeof _radius === 'function' ? _radius(b) : _radius;
          const minD = rA + rB;

          let dx = b.x + (b.vx || 0) - a.x - (a.vx || 0);
          let dy = b.y + (b.vy || 0) - a.y - (a.vy || 0);
          let l2 = dx * dx + dy * dy;

          if (l2 < minD * minD) {
            let l = Math.sqrt(l2);
            if (l === 0) {
              l = 1e-4;
              dx = (Math.random() - 0.5) * 1e-4;
              dy = (Math.random() - 0.5) * 1e-4;
            }
            const push = (minD - l) / l * 0.5;
            const fx = dx * push;
            const fy = dy * push;

            if (a.fx == null) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (b.fx == null) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        }
      }
    }
  }

  force.initialize = function(nodes) {
    _nodes = nodes;
  };

  force.radius = function(r) {
    if (!arguments.length) return _radius;
    _radius = typeof r === 'function' ? r : () => +r;
    return force;
  };

  force.iterations = function(it) {
    if (!arguments.length) return _iterations;
    _iterations = +it;
    return force;
  };

  return force;
}

export function forceX(x = 0) {
  let _nodes = [];
  let _x = typeof x === 'function' ? x : () => +x;
  let _strength = () => 0.1;

  function force(alpha) {
    for (let i = 0; i < _nodes.length; i++) {
      const node = _nodes[i];
      if (node.fx == null) {
        const target = typeof _x === 'function' ? _x(node) : _x;
        const str = typeof _strength === 'function' ? _strength(node) : _strength;
        node.vx += (target - node.x) * str * alpha;
      }
    }
  }

  force.initialize = function(nodes) {
    _nodes = nodes;
  };

  force.strength = function(s) {
    if (!arguments.length) return _strength;
    _strength = typeof s === 'function' ? s : () => +s;
    return force;
  };

  force.x = function(val) {
    if (!arguments.length) return _x;
    _x = typeof val === 'function' ? val : () => +val;
    return force;
  };

  return force;
}

export function forceY(y = 0) {
  let _nodes = [];
  let _y = typeof y === 'function' ? y : () => +y;
  let _strength = () => 0.1;

  function force(alpha) {
    for (let i = 0; i < _nodes.length; i++) {
      const node = _nodes[i];
      if (node.fy == null) {
        const target = typeof _y === 'function' ? _y(node) : _y;
        const str = typeof _strength === 'function' ? _strength(node) : _strength;
        node.vy += (target - node.y) * str * alpha;
      }
    }
  }

  force.initialize = function(nodes) {
    _nodes = nodes;
  };

  force.strength = function(s) {
    if (!arguments.length) return _strength;
    _strength = typeof s === 'function' ? s : () => +s;
    return force;
  };

  force.y = function(val) {
    if (!arguments.length) return _y;
    _y = typeof val === 'function' ? val : () => +val;
    return force;
  };

  return force;
}

export function forceSimulation(nodes = []) {
  let _nodes = nodes;
  let _alpha = 1;
  let _alphaMin = 0.001;
  let _alphaDecay = 0.012;
  let _alphaTarget = 0;
  let _velocityDecay = 0.52;
  const _forces = new Map();
  const _listeners = new Map();
  let _stepper = null;
  let _running = false;

  function step() {
    _alpha += (_alphaTarget - _alpha) * _alphaDecay;

    _forces.forEach(force => {
      force(_alpha);
    });

    for (let i = 0; i < _nodes.length; i++) {
      const node = _nodes[i];
      if (node.fx != null) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx = (node.vx || 0) * (1 - _velocityDecay);
        node.x += node.vx;
      }
      if (node.fy != null) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.vy = (node.vy || 0) * (1 - _velocityDecay);
        node.y += node.vy;
      }

      if (isNaN(node.x)) node.x = 0;
      if (isNaN(node.y)) node.y = 0;
      if (isNaN(node.vx)) node.vx = 0;
      if (isNaN(node.vy)) node.vy = 0;
    }

    const tickListeners = _listeners.get('tick');
    if (tickListeners) {
      tickListeners.forEach(listener => listener());
    }

    if (_alpha < _alphaMin && _alphaTarget <= _alphaMin) {
      sim.stop();
      const endListeners = _listeners.get('end');
      if (endListeners) endListeners.forEach(l => l());
    }
  }

  function loop() {
    if (!_running) return;
    step();
    _stepper = requestAnimationFrame(loop);
  }

  const sim = {
    tick(iterations = 1) {
      for (let i = 0; i < iterations; i++) step();
      return sim;
    },
    restart() {
      if (!_running) {
        _running = true;
        _stepper = requestAnimationFrame(loop);
      }
      return sim;
    },
    stop() {
      _running = false;
      if (_stepper) {
        cancelAnimationFrame(_stepper);
        _stepper = null;
      }
      return sim;
    },
    nodes(n) {
      if (!arguments.length) return _nodes;
      _nodes = n;
      for (let i = 0; i < _nodes.length; i++) {
        const node = _nodes[i];
        if (node.x == null) node.x = (Math.random() - 0.5) * 50;
        if (node.y == null) node.y = (Math.random() - 0.5) * 50;
        if (node.vx == null) node.vx = 0;
        if (node.vy == null) node.vy = 0;
      }
      _forces.forEach(force => {
        if (force.initialize) force.initialize(_nodes);
      });
      return sim;
    },
    alpha(a) {
      if (!arguments.length) return _alpha;
      _alpha = +a;
      return sim;
    },
    alphaTarget(at) {
      if (!arguments.length) return _alphaTarget;
      _alphaTarget = +at;
      return sim;
    },
    alphaDecay(ad) {
      if (!arguments.length) return _alphaDecay;
      _alphaDecay = +ad;
      return sim;
    },
    velocityDecay(vd) {
      if (!arguments.length) return _velocityDecay;
      _velocityDecay = +vd;
      return sim;
    },
    force(name, f) {
      if (arguments.length === 1) return _forces.get(name);
      if (f == null) _forces.delete(name);
      else {
        _forces.set(name, f);
        if (f.initialize) f.initialize(_nodes);
      }
      return sim;
    },
    on(type, listener) {
      if (!listener) return _listeners.get(type);
      if (!_listeners.has(type)) _listeners.set(type, new Set());
      _listeners.get(type).add(listener);
      return sim;
    }
  };

  sim.nodes(nodes);
  sim.restart();
  return sim;
}
