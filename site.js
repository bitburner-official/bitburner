(function () {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (var k in src) tar[k] = src[k];
		return tar;
	}

	function isPromise(value) {
		return value && typeof value.then === 'function';
	}

	function addLoc(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function destroyEach(iterations, detach) {
		for (var i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detach);
		}
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function createComment() {
		return document.createComment('');
	}

	function addListener(node, event, handler) {
		node.addEventListener(event, handler, false);
	}

	function removeListener(node, event, handler) {
		node.removeEventListener(event, handler, false);
	}

	function setData(text, data) {
		text.data = '' + data;
	}

	function handlePromise(promise, info) {
		var token = info.token = {};

		function update(type, index, key, value) {
			if (info.token !== token) return;

			info.resolved = key && { [key]: value };

			const child_ctx = assign(assign({}, info.ctx), info.resolved);
			const block = type && (info.current = type)(info.component, child_ctx);

			if (info.block) {
				if (info.blocks) {
					info.blocks.forEach((block, i) => {
						if (i !== index && block) {
							block.o(() => {
								block.d(1);
								info.blocks[i] = null;
							});
						}
					});
				} else {
					info.block.d(1);
				}

				block.c();
				block[block.i ? 'i' : 'm'](info.mount(), info.anchor);

				info.component.root.set({}); // flush any handlers that were created
			}

			info.block = block;
			if (info.blocks) info.blocks[index] = block;
		}

		if (isPromise(promise)) {
			promise.then(value => {
				update(info.then, 1, info.value, value);
			}, error => {
				update(info.catch, 2, info.error, error);
			});

			// if we previously had a then/catch block, destroy it
			if (info.current !== info.pending) {
				update(info.pending, 0);
				return true;
			}
		} else {
			if (info.current !== info.then) {
				update(info.then, 1, info.value, promise);
				return true;
			}

			info.resolved = { [info.value]: promise };
		}
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function destroyDev(detach) {
		destroy.call(this, detach);
		this.destroy = function() {
			console.warn('Component was already destroyed');
		};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) return;

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				try {
					handler.__calling = true;
					handler.call(this, data);
				} finally {
					handler.__calling = false;
				}
			}
		}
	}

	function flush(component) {
		component._lock = true;
		callAll(component._beforecreate);
		callAll(component._oncreate);
		callAll(component._aftercreate);
		component._lock = false;
	}

	function get() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._slots = blankObject();
		component._bind = options._bind;
		component._staged = {};

		component.options = options;
		component.root = options.root || component;
		component.store = options.store || component.root.store;

		if (!options.root) {
			component._beforecreate = [];
			component._oncreate = [];
			component._aftercreate = [];
		}
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) handlers.splice(index, 1);
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) return;
		flush(this.root);
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		newState = assign(this._staged, newState);
		this._staged = {};

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) this._bind(changed, this._state);

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function _stage(newState) {
		assign(this._staged, newState);
	}

	function setDev(newState) {
		if (typeof newState !== 'object') {
			throw new Error(
				this._debugName + '.set was called without an object of data key-values to update.'
			);
		}

		this._checkReadOnly(newState);
		set.call(this, newState);
	}

	function callAll(fns) {
		while (fns && fns.length) fns.shift()();
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	var protoDev = {
		destroy: destroyDev,
		get,
		fire,
		on,
		set: setDev,
		_recompute: noop,
		_set,
		_stage,
		_mount,
		_differs
	};

	/* src/site/script.html generated by Svelte v2.13.5 */

	const copyToClipboard = str => {
	  const el = document.createElement('textarea');  // Create a <textarea> element
	  el.value = str;                                 // Set its value to the string that you want copied
	  el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
	  el.style.position = 'absolute';
	  el.style.left = '-9999px';                      // Move outside the screen to make it invisible
	  document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
	  const selected =
	    document.getSelection().rangeCount > 0        // Check if there is any content selected previously
	      ? document.getSelection().getRangeAt(0)     // Store selection if found
	      : false;                                    // Mark as false to know no selection existed before
	  el.select();                                    // Select the <textarea> content
	  document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
	  document.body.removeChild(el);                  // Remove the <textarea> element
	  if (selected) {                                 // If a selection existed before copying
	    document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
	    document.getSelection().addRange(selected);   // Restore the original selection
	  }
	};

	var methods = {
	  copyToClipboard(evt, script) {
	    const command = `wget https://alxandr.github.io/bitburner/${script} ${script}`;
	    console.log(command);
	    copyToClipboard(command);
	  }
	};

	const file = "src/site/script.html";

	function create_main_fragment(component, ctx) {
		var div, h3, text, text_1, code, span, text_2, span_1, text_3, text_4, button, i, text_5;

		function click_handler(event) {
			component.copyToClipboard(event, ctx.script);
		}

		return {
			c: function create() {
				div = createElement("div");
				h3 = createElement("h3");
				text = createText(ctx.script);
				text_1 = createText("\n  ");
				code = createElement("code");
				span = createElement("span");
				text_2 = createText("https://alxandr.github.io/bitburner/");
				span_1 = createElement("span");
				text_3 = createText(ctx.script);
				text_4 = createText("\n  ");
				button = createElement("button");
				i = createElement("i");
				text_5 = createText("Copy");
				h3.className = "name svelte-1r3a1he";
				addLoc(h3, file, 1, 2, 25);
				span.className = "trivial-path svelte-1r3a1he";
				addLoc(span, file, 2, 21, 77);
				addLoc(span_1, file, 2, 91, 147);
				code.className = "path svelte-1r3a1he";
				addLoc(code, file, 2, 2, 58);
				i.className = "fa-copy svelte-1r3a1he";
				addLoc(i, file, 3, 65, 241);
				addListener(button, "click", click_handler);
				button.className = "copy svelte-1r3a1he";
				addLoc(button, file, 3, 2, 178);
				div.className = "root row svelte-1r3a1he";
				addLoc(div, file, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, h3);
				append(h3, text);
				append(div, text_1);
				append(div, code);
				append(code, span);
				append(span, text_2);
				append(code, span_1);
				append(span_1, text_3);
				append(div, text_4);
				append(div, button);
				append(button, i);
				append(i, text_5);
			},

			p: function update(changed, _ctx) {
				ctx = _ctx;
				if (changed.script) {
					setData(text, ctx.script);
					setData(text_3, ctx.script);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				removeListener(button, "click", click_handler);
			}
		};
	}

	function Script(options) {
		this._debugName = '<Script>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign({}, options.data);
		if (!('script' in this._state)) console.warn("<Script> was created without expected data property 'script'");
		this._intro = true;

		this._fragment = create_main_fragment(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}
	}

	assign(Script.prototype, protoDev);
	assign(Script.prototype, methods);

	Script.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	/* src/site/site.html generated by Svelte v2.13.5 */

	function data() {
	  return {
	    manifest: fetch("manifest.json").then(r => r.json())
	  };
	}
	const file$1 = "src/site/site.html";

	function create_main_fragment$1(component, ctx) {
		var div, div_1, h1, text, text_1, promise;

		let info = {
			component,
			ctx,
			current: null,
			pending: create_pending_block,
			then: create_then_block,
			catch: create_catch_block,
			value: 'm',
			error: 'error'
		};

		handlePromise(promise = ctx.manifest, info);

		return {
			c: function create() {
				div = createElement("div");
				div_1 = createElement("div");
				h1 = createElement("h1");
				text = createText("Script files");
				text_1 = createText("\n    ");

				info.block.c();
				addLoc(h1, file$1, 2, 4, 62);
				div_1.className = "column";
				addLoc(div_1, file$1, 1, 2, 37);
				div.className = "container offset-top svelte-9e57fz";
				addLoc(div, file$1, 0, 0, 0);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, div_1);
				append(div_1, h1);
				append(h1, text);
				append(div_1, text_1);

				info.block.m(div_1, info.anchor = null);
				info.mount = () => div_1;
			},

			p: function update(changed, _ctx) {
				ctx = _ctx;
				info.ctx = ctx;

				if (('manifest' in changed) && promise !== (promise = ctx.manifest) && handlePromise(promise, info)) ; else {
					info.block.p(changed, assign(assign({}, ctx), info.resolved));
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}

				info.block.d();
				info = null;
			}
		};
	}

	// (4:21)      <div class="row">       <sub class="sub">Loading...</sub>     </div>     {:then m}
	function create_pending_block(component, ctx) {
		var div, sub, text;

		return {
			c: function create() {
				div = createElement("div");
				sub = createElement("sub");
				text = createText("Loading...");
				sub.className = "sub svelte-9e57fz";
				addLoc(sub, file$1, 5, 6, 134);
				div.className = "row";
				addLoc(div, file$1, 4, 4, 110);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, sub);
				append(sub, text);
			},

			p: noop,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	// (15:4) {#each m.scripts as script}
	function create_each_block(component, ctx) {

		var scriptblock_initial_data = { script: ctx.script };
		var scriptblock = new Script({
			root: component.root,
			store: component.store,
			data: scriptblock_initial_data
		});

		return {
			c: function create() {
				scriptblock._fragment.c();
			},

			m: function mount(target, anchor) {
				scriptblock._mount(target, anchor);
			},

			p: function update(changed, ctx) {
				var scriptblock_changes = {};
				if (changed.manifest) scriptblock_changes.script = ctx.script;
				scriptblock._set(scriptblock_changes);
			},

			d: function destroy$$1(detach) {
				scriptblock.destroy(detach);
			}
		};
	}

	// (17:4) {:else}
	function create_each_block_else(component, ctx) {
		var div, p, text;

		return {
			c: function create() {
				div = createElement("div");
				p = createElement("p");
				text = createText("No scripts");
				addLoc(p, file$1, 18, 6, 514);
				div.className = "row";
				addLoc(div, file$1, 17, 4, 490);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(p, text);
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	// (8:4) {:then m}
	function create_then_block(component, ctx) {
		var div, sub, text, time, text_1_value = new ctx.Date(ctx.m.date).toLocaleString(), text_1, time_datetime_value, text_2, span, text_3_value = ctx.m.hash, text_3, text_6, each_anchor;

		var each_value = ctx.m.scripts;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
		}

		var each_else = null;

		if (!each_value.length) {
			each_else = create_each_block_else(component, ctx);
			each_else.c();
		}

		return {
			c: function create() {
				div = createElement("div");
				sub = createElement("sub");
				text = createText("Date: ");
				time = createElement("time");
				text_1 = createText(text_1_value);
				text_2 = createText("\n        Hash: ");
				span = createElement("span");
				text_3 = createText(text_3_value);
				text_6 = createText("\n    ");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
				time.dateTime = time_datetime_value = new ctx.Date(ctx.m.date).toISOString();
				addLoc(time, file$1, 10, 14, 253);
				addLoc(span, file$1, 11, 14, 360);
				sub.className = "sub svelte-9e57fz";
				addLoc(sub, file$1, 9, 6, 221);
				div.className = "row";
				addLoc(div, file$1, 8, 4, 197);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, sub);
				append(sub, text);
				append(sub, time);
				append(time, text_1);
				append(sub, text_2);
				append(sub, span);
				append(span, text_3);
				insert(target, text_6, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);

				if (each_else) {
					each_else.m(target, null);
				}
			},

			p: function update(changed, ctx) {
				if ((changed.Date || changed.manifest) && text_1_value !== (text_1_value = new ctx.Date(ctx.m.date).toLocaleString())) {
					setData(text_1, text_1_value);
				}

				if ((changed.Date || changed.manifest) && time_datetime_value !== (time_datetime_value = new ctx.Date(ctx.m.date).toISOString())) {
					time.dateTime = time_datetime_value;
				}

				if ((changed.manifest) && text_3_value !== (text_3_value = ctx.m.hash)) {
					setData(text_3, text_3_value);
				}

				if (changed.manifest) {
					each_value = ctx.m.scripts;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if (each_value.length) {
					if (each_else) {
						each_else.d(1);
						each_else = null;
					}
				} else if (!each_else) {
					each_else = create_each_block_else(component, ctx);
					each_else.c();
					each_else.m(each_anchor.parentNode, each_anchor);
				}
			},

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
					detachNode(text_6);
				}

				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}

				if (each_else) each_else.d(detach);
			}
		};
	}

	// (22:4) {:catch error}
	function create_catch_block(component, ctx) {
		var div, sub, text;

		return {
			c: function create() {
				div = createElement("div");
				sub = createElement("sub");
				text = createText("Failed to load :(");
				addLoc(sub, file$1, 23, 6, 602);
				div.className = "row";
				addLoc(div, file$1, 22, 4, 578);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, sub);
				append(sub, text);
			},

			p: noop,

			d: function destroy$$1(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.script = list[i];
		child_ctx.each_value = list;
		child_ctx.script_index = i;
		return child_ctx;
	}

	function Site(options) {
		this._debugName = '<Site>';
		if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
		init(this, options);
		this._state = assign(assign({ Date : Date }, data()), options.data);
		if (!('manifest' in this._state)) console.warn("<Site> was created without expected data property 'manifest'");
		this._intro = true;

		this._fragment = create_main_fragment$1(this, this._state);

		if (options.target) {
			if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}
	}

	assign(Site.prototype, protoDev);

	Site.prototype._checkReadOnly = function _checkReadOnly(newState) {
	};

	const init$1 = () => {
	  if (document.body) {
	    new Site({ target: document.body });
	  } else {
	    setTimeout(init$1, 10);
	  }
	};

	init$1();

}());
