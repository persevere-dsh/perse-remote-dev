window.__ModuleLoader__.load({
	id: "perse-remote-dev",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region node_modules/zod/v4/core/util.js
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function joinValues(array, separator = "|") {
			return array.map((val) => stringifyPrimitive(val)).join(separator);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		var Cached = class {
			constructor(getter) {
				this._getter = getter;
				this._value = void 0;
			}
			get value() {
				const getter = this._getter;
				if (getter !== void 0) {
					this._value = getter();
					this._getter = void 0;
				}
				return this._value;
			}
		};
		function cached(getter) {
			return new Cached(getter);
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		/**
		* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
		*
		* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
		*/
		function rawShape(def) {
			const desc = Object.getOwnPropertyDescriptor(def, "shape");
			return desc?.get ? desc.get.raw : desc?.value;
		}
		function sourceShape(schema) {
			return rawShape(schema._zod.def) ?? schema._zod.def.shape;
		}
		function deferProp(target, key, getter) {
			Object.defineProperty(target, key, {
				get() {
					const value = getter();
					assignProp(this, key, value);
					return value;
				},
				enumerable: true,
				configurable: true
			});
		}
		function putProp(target, key, value) {
			if (key in target) assignProp(target, key, value);
			else target[key] = value;
		}
		/**
		* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
		*
		* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
		*/
		function mirrorShape(target, source, keys, wrap) {
			const raw = sourceShape(source);
			for (const key of keys) {
				const desc = Object.getOwnPropertyDescriptor(raw, key);
				if (!desc.enumerable) continue;
				if (desc.get) deferProp(target, key, () => {
					const value = source._zod.def.shape[key];
					return wrap ? wrap(value, key) : value;
				});
				else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
			}
		}
		function mirrorProps(target, source) {
			for (const key of Reflect.ownKeys(source)) {
				const desc = Object.getOwnPropertyDescriptor(source, key);
				if (!desc.enumerable) continue;
				if (desc.get) deferProp(target, key, () => source[key]);
				else putProp(target, key, desc.value);
			}
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) {
				const descriptors = Object.getOwnPropertyDescriptors(def);
				Object.assign(mergedDescriptors, descriptors);
			}
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function stringifyPrimitive(value) {
			if (typeof value === "bigint") return value.toString() + "n";
			if (typeof value === "string") return `"${value}"`;
			return `${value}`;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		}))();
		const BIGINT_FORMAT_RANGES = {
			int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
			uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			const newShape = {};
			mirrorShape(newShape, schema, maskedKeys(schema, mask));
			return clone(schema, mergeDefs(currDef, {
				shape: newShape,
				checks: []
			}));
		}
		function maskedKeys(schema, mask) {
			const raw = sourceShape(schema);
			const keys = [];
			for (const key of Reflect.ownKeys(mask)) {
				if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
				if (mask[key]) keys.push(key);
			}
			return keys;
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			const omitted = new Set(maskedKeys(schema, mask));
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
			return clone(schema, mergeDefs(currDef, {
				shape: newShape,
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = sourceShape(schema);
				for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
		}
		function extended(schema, shape) {
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
			mirrorProps(newShape, shape);
			return newShape;
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
		}
		function merge(a, b) {
			if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			const newShape = {};
			mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
			mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
			return clone(a, mergeDefs(a._zod.def, {
				shape: newShape,
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask, name = "partial") {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
			const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
				type: "optional",
				innerType: value
			})));
			return clone(schema, mergeDefs(schema._zod.def, {
				shape: newShape,
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
				type: "nonoptional",
				innerType: value
			}));
			return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		function attachSchema(issues, start, inst) {
			var _a;
			for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
		}
		function finalizeIssue(iss, ctx, config) {
			var _a;
			const traits = iss.inst?._zod?.traits;
			if (traits?.has("$ZodType")) {
				if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
				else iss.schema = iss.inst;
			}
			const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const full = {};
			for (const k of Object.keys(iss)) {
				if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
				full[k] = iss[k];
			}
			full.path ?? (full.path = []);
			full.message = message;
			if (ctx?.reportInput) full.input = iss.input;
			return full;
		}
		const highSurrogate = /[\uD800-\uDBFF]/;
		function codePointLength(str) {
			const units = str.length;
			if (!highSurrogate.test(str)) return units;
			let count = units;
			for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
				count--;
				i++;
			}
			return count;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function parsedType(data) {
			const t = typeof data;
			switch (t) {
				case "number": return Number.isNaN(data) ? "nan" : "number";
				case "object": {
					if (data === null) return "null";
					if (Array.isArray(data)) return "array";
					const obj = data;
					if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
				}
			}
			return t;
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		/**
		* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
		*
		* Call this from a `proto` initializer, which runs once per prototype — never per instance.
		*/
		function members(proto, table) {
			for (const key in table) {
				const desc = Object.getOwnPropertyDescriptor(table, key);
				if (desc.get) Object.defineProperty(proto, key, {
					...desc,
					enumerable: false
				});
				else defineBound(proto, key, desc.value);
			}
			for (const sym of Object.getOwnPropertySymbols(table)) defineBound(proto, sym, table[sym]);
		}
		/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
		function own(inst, key, value, enumerable = true) {
			Object.defineProperty(inst, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
			return value;
		}
		/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
		function hide(inst, key, value) {
			return own(inst, key, value, false);
		}
		/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
		function derived(computes, table) {
			for (const key in computes) {
				const compute = computes[key];
				Object.defineProperty(table, key, {
					configurable: true,
					enumerable: true,
					get() {
						return own(this, key, compute(this));
					},
					set(value) {
						own(this, key, value);
					}
				});
			}
			return table;
		}
		function defineBound(proto, key, fn) {
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					return this == null ? fn : own(this, key, fn.bind(this));
				},
				set(value) {
					own(this, key, value);
				}
			});
		}
		/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
		function claim(inst, sentinel) {
			const proto = Object.getPrototypeOf(inst);
			return sentinel in proto ? void 0 : proto;
		}
		let installing;
		let broke = false;
		const breaker = {
			configurable: true,
			get() {
				broke = true;
			}
		};
		/**
		* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
		* constructor, computed from the internals object itself and cached there on
		* first read. One accessor per constructor rather than one per instance.
		*/
		function defineLazyInternal(inst, key, compute) {
			const proto = Object.getPrototypeOf(inst._zod);
			if (key in proto && installing !== inst._zod) {
				installing = void 0;
				return;
			}
			installing = inst._zod;
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					Object.defineProperty(this, key, breaker);
					const outer = broke;
					broke = false;
					try {
						const value = compute(this);
						if (broke) delete this[key];
						else Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							value
						});
						broke = broke || outer;
						return value;
					} catch (err) {
						delete this[key];
						broke = broke || outer;
						throw err;
					}
				},
				set(value) {
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						value
					});
				}
			});
		}
		/**
		* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
		* data property. One accessor per constructor rather than one per instance, because an own accessor
		* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
		*/
		function installLazyProp(inst, key, make, enumerable) {
			const proto = claim(inst, key);
			if (!proto) return;
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					const desc = {
						configurable: true,
						writable: true,
						enumerable,
						value: void 0
					};
					Object.defineProperty(this, key, desc);
					desc.value = make(this);
					Object.defineProperty(this, key, desc);
					return desc.value;
				},
				set(value) {
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						enumerable,
						value
					});
				}
			});
		}
		/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
		const CONSTANT_CATCH = "~constantCatch";
		/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
		function constantCatch(value) {
			const fn = () => value;
			fn[CONSTANT_CATCH] = true;
			return fn;
		}
		//#endregion
		//#region node_modules/zod/v4/core/core.js
		var _a$1;
		const _zodDesc = {
			value: void 0,
			enumerable: false
		};
		let _E = "captureStackTrace" in Error ? Error : null;
		function newError(Definition) {
			const E = _E;
			if (E) {
				const saved = E.stackTraceLimit;
				if (typeof saved === "number") {
					try {
						E.stackTraceLimit = 0;
					} catch {
						_E = null;
						return new Definition();
					}
					try {
						return new Definition();
					} finally {
						E.stackTraceLimit = saved;
					}
				}
			}
			return new Definition();
		}
		function $constructor(name, initializer, proto, params) {
			const zodProto = {};
			function Internals(def) {
				this.def = def;
				this.constr = _;
				this.traits = /* @__PURE__ */ new Set();
			}
			Internals.prototype = zodProto;
			const protoMembers = proto;
			const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
			function init(inst, def) {
				if (!inst._zod) {
					_zodDesc.value = new Internals(def);
					try {
						Object.defineProperty(inst, "_zod", _zodDesc);
					} finally {
						_zodDesc.value = void 0;
					}
				}
				if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				if (initialized) {
					const own = Object.getPrototypeOf(inst);
					const ctorProto = inst._zod.constr.prototype;
					let up = own;
					while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
					const target = up ?? own;
					if (!initialized.has(target)) {
						initialized.add(target);
						members(target, protoMembers);
					}
				}
				const proto = _.prototype;
				for (const k in proto) {
					if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				const inst = params?.Parent ? newError(Definition) : this;
				init(inst, def);
				const deferred = inst._zod.deferred;
				if (deferred) {
					for (const fn of deferred) fn();
					inst._zod.deferred = void 0;
				}
				const pp = globalThis.__zod_globalConfig?.postProcessor;
				if (pp) pp(inst);
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		//#endregion
		//#region node_modules/zod/v4/core/errors.js
		function _getMessage() {
			const internals = this._zod;
			internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
			return internals.message;
		}
		function _setMessage(value) {
			this._zod.message = value;
		}
		const _messageDesc = {
			get: _getMessage,
			set: _setMessage,
			enumerable: true,
			configurable: true
		};
		const _issuesDesc = {
			value: void 0,
			enumerable: false
		};
		const _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			_issuesDesc.value = def;
			Object.defineProperty(inst, "issues", _issuesDesc);
			_issuesDesc.value = void 0;
			Object.defineProperty(inst, "message", _messageDesc);
			const proto = Object.getPrototypeOf(inst);
			if (!_installedToString.has(proto)) {
				_installedToString.add(proto);
				Object.defineProperty(proto, "toString", {
					configurable: true,
					enumerable: false,
					get() {
						const value = () => this.message;
						Object.defineProperty(this, "toString", {
							value,
							configurable: true,
							writable: true
						});
						return value;
					},
					set(value) {
						Object.defineProperty(this, "toString", {
							value,
							configurable: true,
							writable: true
						});
					}
				});
			}
		};
		const $ZodError = $constructor("$ZodError", initializer$1);
		$constructor("$ZodError", initializer$1, void 0, { Parent: Error });
		/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
		* ("toString", "constructor") would otherwise read through to the prototype, and assigning
		* "__proto__" would hit the setter instead of creating a key. */
		function node(obj, key, make) {
			if (!Object.prototype.hasOwnProperty.call(obj, key)) {
				if (key === "__proto__") Object.defineProperty(obj, key, {
					value: make(),
					writable: true,
					enumerable: true,
					configurable: true
				});
				else obj[key] = make();
			}
			return obj[key];
		}
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
			else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							const terminal = i === fullpath.length - 1;
							if (el === "_errors") {
								if (terminal) curr._errors.push(mapper(issue));
								i++;
								continue;
							}
							if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
								value: { _errors: [] },
								enumerable: true,
								writable: true,
								configurable: true
							});
							const node = curr[el];
							if (terminal) node._errors.push(mapper(issue));
							curr = node;
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		//#endregion
		//#region node_modules/zod/v4/core/parse.js
		function finalizeParams(callee, params) {
			return {
				callee: params?.callee ?? callee,
				Err: params?.Err
			};
		}
		const _parse = (_Err) => {
			const fn = (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					async: false
				} : { async: false };
				const result = schema._zod.run({
					value,
					issues: []
				}, ctx);
				if (result instanceof Promise) throw new $ZodAsyncError();
				if (result.issues.length) {
					const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
					captureStackTrace(e, _params?.callee ?? fn);
					throw e;
				}
				return result.value;
			};
			return fn;
		};
		const _parseAsync = (_Err) => {
			const fn = async (schema, value, _ctx, params) => {
				const ctx = _ctx ? {
					..._ctx,
					async: true
				} : { async: true };
				let result = schema._zod.run({
					value,
					issues: []
				}, ctx);
				if (result instanceof Promise) result = await result;
				if (result.issues.length) {
					const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
					captureStackTrace(e, params?.callee ?? fn);
					throw e;
				}
				return result.value;
			};
			return fn;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? failure(_Err, result.issues, ctx) : {
				success: true,
				data: result.value
			};
		};
		function failure(Err, issues, ctx) {
			let error;
			return {
				success: false,
				get error() {
					if (!error) {
						error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
						issues = void 0;
						ctx = void 0;
					}
					return error;
				},
				set error(e) {
					error = e;
					issues = void 0;
					ctx = void 0;
				}
			};
		}
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? failure(_Err, result.issues, ctx) : {
				success: true,
				data: result.value
			};
		};
		const COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
		const COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
		const validate = ((schema, value, _ctx) => {
			const validator = schema._zod.bag.validator;
			if (validator !== void 0) {
				if (validator(value) !== COMPILE_INVALID) return true;
				if (validator.definite === true && _ctx === void 0) return false;
			}
			return validateFallback(schema, value, _ctx);
		});
		function validateFallback(schema, value, _ctx) {
			const ctx = _ctx ? {
				..._ctx,
				async: false,
				abortEarly: true
			} : {
				async: false,
				abortEarly: true
			};
			const fallbackRun = schema._zod.bag.fallbackRun;
			let result;
			if (fallbackRun) {
				ctx[COMPILE_FALLBACK] = true;
				result = fallbackRun({
					value,
					issues: []
				}, ctx);
			} else result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length === 0;
		}
		const validateAsync$1 = async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true,
				abortEarly: true
			} : {
				async: true,
				abortEarly: true
			};
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length === 0;
		};
		const _encode = (_Err) => {
			const parse = _parse(_Err);
			const fn = (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					direction: "backward"
				} : { direction: "backward" };
				return parse(schema, value, ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _decode = (_Err) => {
			const parse = _parse(_Err);
			const fn = (schema, value, _ctx, _params) => {
				return parse(schema, value, _ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _encodeAsync = (_Err) => {
			const parseAsync = _parseAsync(_Err);
			const fn = async (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					direction: "backward"
				} : { direction: "backward" };
				return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _decodeAsync = (_Err) => {
			const parseAsync = _parseAsync(_Err);
			const fn = async (schema, value, _ctx, _params) => {
				return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		//#endregion
		//#region node_modules/zod/v4/core/regexes.js
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		function nanoidOfLength(length) {
			return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
		}
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		/** Anchors a pattern source. The interpolation lives here rather than at the call site because
		* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
		* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
		function anchor(source) {
			return new RegExp(`^${source}$`);
		}
		const date = /*@__PURE__*/ anchor(dateSource);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime(args) {
			const opts = ["Z"];
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const qualified = `${timeSource({
				precision: args.precision,
				seconds: true
			})}(?:${opts.join("|")})`;
			const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const anyString = /^[\s\S]{0,}$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		//#endregion
		//#region node_modules/zod/v4/core/checks.js
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
		const _whenHasLength = (payload) => {
			const val = payload.value;
			return !nullish(val) && val.length !== void 0;
		};
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin: numericOriginMap[typeof payload.value] ?? origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin: numericOriginMap[typeof payload.value] ?? origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		//#endregion
		//#region node_modules/zod/v4/core/doc.js
		var Doc = class {
			constructor(args = [], closed = {}) {
				this.content = [];
				this.indent = 0;
				this.args = args;
				this.closed = closed;
			}
			indented(fn) {
				this.indent += 1;
				try {
					fn(this);
				} finally {
					this.indent -= 1;
				}
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const content = this?.content ?? [``];
				return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
			}
		};
		//#endregion
		//#region node_modules/zod/v4/core/versions.js
		const version = {
			major: 4,
			minor: 6,
			patch: 2
		};
		//#endregion
		//#region node_modules/zod/v4/core/schemas.js
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const defChecks = inst._zod.def.checks;
			const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					if (payload.memo) return payload;
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							attachSchema(payload.issues, currLen, inst);
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							attachSchema(payload.issues, currLen, inst);
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
		}, {
			get "~standard"() {
				return hide(this, "~standard", standardProps(this));
			},
			set "~standard"(value) {
				own(this, "~standard", value);
			}
		});
		/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
		const toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
		async function validateAsync(inst, value) {
			const ctx = { async: true };
			return toStandardResult(await inst._zod.run({
				value,
				issues: []
			}, ctx), ctx);
		}
		function standardProps(inst) {
			return {
				validate: (value) => {
					const ctx = { async: false };
					try {
						const r = inst._zod.run({
							value,
							issues: []
						}, ctx);
						if (!(r instanceof Promise)) return toStandardResult(r, ctx);
					} catch (_) {}
					return validateAsync(inst, value);
				},
				vendor: "zod",
				version: 1
			};
		}
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = def.pattern ?? anyString;
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		/** Parses a URL for `$ZodURL`, applying the one guard the URL constructor cannot express. Returns the parsed URL, or a code naming the stage that rejected it — the runtime needs that distinction to pick an issue note, and compiled code only needs to know it is not a URL. */
		function parseURLObject(trimmed, def) {
			if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
			try {
				return new URL(trimmed);
			} catch {
				return 2;
			}
		}
		const asciiTabOrNewline = /[\t\n\r]/g;
		/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
		function stripTabAndNewline(value) {
			return value.replace(asciiTabOrNewline, "");
		}
		function urlHostnameOk(url, hostname) {
			hostname.lastIndex = 0;
			return hostname.test(url.hostname);
		}
		function urlProtocolOk(url, protocol) {
			protocol.lastIndex = 0;
			return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
		}
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					const url = parseURLObject(trimmed, def);
					if (url === 1) {
						payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid URL format",
							input: payload.value,
							inst,
							continue: !def.abort
						});
						return;
					}
					if (url === 2) {
						payload.issues.push({
							code: "invalid_format",
							format: "url",
							input: payload.value,
							inst,
							continue: !def.abort
						});
						return;
					}
					if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid hostname",
						pattern: def.hostname.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
					if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid protocol",
						pattern: def.protocol.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
					payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
			def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
		});
		/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
		const ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
		function isValidIPv6(value) {
			if (!ipv6Alphabet.test(value)) return false;
			try {
				new URL(`http://[${value}]`);
				return true;
			} catch {
				return false;
			}
		}
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (!isValidIPv6(payload.value)) payload.issues.push({
					code: "invalid_format",
					format: "ipv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		function isValidCIDRv6(value) {
			const parts = value.split("/");
			if (parts.length !== 2) return false;
			const [address, prefix] = parts;
			if (!prefix) return false;
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) return false;
			if (prefixNum < 0 || prefixNum > 128) return false;
			return isValidIPv6(address);
		}
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (!isValidCIDRv6(payload.value)) payload.issues.push({
					code: "invalid_format",
					format: "cidrv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64Charset);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const base64urlCharset = /^[A-Za-z0-9_-]*$/;
		function isValidBase64URL(data) {
			if (!base64urlCharset.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64urlCharset);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			const memo = globalConfig.memoizer;
			memo?.attach(inst);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
				const proms = [];
				const abortEarly = ctx?.abortEarly;
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else {
						handleArrayResult(result, payload, i);
						if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
					}
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		function handlePropertyResult(result, final, key, input, optin, optout) {
			const isPresent = key in input;
			const isOptionalOut = optout === "optional";
			if (!isPresent && isOptionalOut && optin === "optional") return;
			if (result.issues.length) {
				if (optin !== void 0 && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && optin === void 0) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		const NO_SYMBOL_KEYS = [];
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			const ownSymbols = Object.getOwnPropertySymbols(def.shape);
			const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
			const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
			for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				allKeys,
				symbolKeys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const optin = _catchall.optin;
			const optout = _catchall.optout;
			let seen = 0;
			for (const key in input) {
				if (abortEarly && payload.issues.length !== seen) {
					if (aborted(payload, seen)) break;
					seen = payload.issues.length;
				}
				if (keySet.has(key)) continue;
				if (key === "__proto__") {
					if (t === "never") unrecognized.push(key);
					continue;
				}
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
				else handlePropertyResult(r, payload, key, input, optin, optout);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst,
				continue: true
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			const desc = Object.getOwnPropertyDescriptor(def, "shape");
			const sh = desc?.get ? desc.get.raw : def.shape ?? {};
			if (sh) {
				const get = () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					get.raw = newSh;
					return newSh;
				};
				get.raw = sh;
				Object.defineProperty(def, "shape", { get });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazyInternal(inst, "propValues", (zod) => {
				const shape = zod.def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
						if (field.optin !== void 0) propValues[key].add(void 0);
					}
				}
				return propValues;
			});
			const isObject$2 = isObject;
			const catchall = def.catchall;
			let value;
			const memo = globalConfig.memoizer;
			memo?.attach(inst);
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
				const proms = [];
				const shape = value.shape;
				const abortEarly = ctx?.abortEarly;
				let seen = payload.issues.length;
				for (const key of value.allKeys) {
					if (abortEarly && payload.issues.length !== seen) {
						if (aborted(payload, seen)) break;
						seen = payload.issues.length;
					}
					if (key === "__proto__") continue;
					const el = shape[key];
					const optin = el._zod.optin;
					const optout = el._zod.optout;
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
					else handlePropertyResult(r, payload, key, input, optin, optout);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const memo = globalConfig.memoizer;
			const generateFastpass = (shape) => {
				const normalized = _normalized.value;
				const syms = normalized.symbolKeys;
				const doc = new Doc(["payload", "ctx"], {
					shape,
					inst,
					memo,
					syms
				});
				const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
				doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
				for (const key of normalized.allKeys) {
					if (key === "__proto__") continue;
					const id = ids[key];
					const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
					const isPresent = `${k} in input`;
					const schema = shape[key];
					const optin = schema?._zod?.optin;
					const isOptionalIn = optin !== void 0;
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(k)};`);
					if (isOptionalIn && isOptionalOut) {
						const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
						doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
					} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
					else {
						doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
						if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
						else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
					}
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				return doc.compile();
			};
			let fastpass;
			const isObject$1 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
			defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazyInternal(inst, "values", (zod) => {
				if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazyInternal(inst, "pattern", (zod) => {
				if (zod.def.options.every((o) => o._zod.pattern)) {
					const patterns = zod.def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
				for (const key of sharedKeys) {
					if (key === "__proto__") continue;
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			const keyIssues = /* @__PURE__ */ new Map();
			const collect = (iss, side) => {
				let keys;
				if (iss.code === "unrecognized_keys" && !iss.path?.length) {
					unrecIssue ?? (unrecIssue = iss);
					keys = iss.keys;
				} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
					const k = String(iss.path[0]);
					if (!keyIssues.has(k)) keyIssues.set(k, iss);
					keys = [k];
				} else return false;
				for (const k of keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k)[side] = true;
				}
				return true;
			};
			for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
			for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length) {
				const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
				if (aggregated.length) result.issues.push({
					...unrecIssue,
					keys: aggregated
				});
				for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
			}
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) {
				if (aborted(result)) return result;
				throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			}
			result.value = merged.data;
			return result;
		}
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			defineLazyInternal(inst, "pattern", (zod) => {
				const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
				return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
			});
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
			$ZodType.init(inst, def);
			const values = new Set(def.values);
			inst._zod.values = values;
			defineLazyInternal(inst, "pattern", (zod) => {
				const vals = zod.def.values;
				return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
			});
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (values.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values: def.values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			globalConfig.memoizer?.guard(inst);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				return payload;
			};
		});
		function handleOptionalResult(payload, result) {
			payload.value = result.issues.length ? void 0 : result.value;
			return payload;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
			inst._zod.optout = "optional";
			defineLazyInternal(inst, "values", (zod) => {
				const values = zod.def.innerType._zod.values;
				return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
			});
			defineLazyInternal(inst, "pattern", (zod) => {
				const pattern = zod.def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === void 0) {
					if (def.innerType._zod.optin !== "defaulted") return payload;
					const result = def.innerType._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
					return handleOptionalResult(payload, result);
				}
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
			defineLazyInternal(inst, "pattern", (zod) => {
				const pattern = zod.def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazyInternal(inst, "values", (zod) => {
				return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "defaulted";
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "defaulted";
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => {
				const v = zod.def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		function handleCatchResult(payload, result, def, ctx) {
			if (!result.issues.length) {
				payload.value = result.value;
				if (result.memo) payload.memo = true;
				return payload;
			}
			payload.value = def.catchValue({
				...result,
				value: payload.value,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run({
					value: payload.value,
					issues: []
				}, ctx);
				if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
				return handleCatchResult(payload, result, def, ctx);
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
			defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
			defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			if (!payload.memo) payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		//#endregion
		//#region node_modules/zod/v4/core/memoizer.js
		var $ZodCyclicError = class extends Error {
			constructor() {
				super(`Cannot parse a reference cycle that closes through a transform`);
				this.name = "ZodCyclicError";
			}
		};
		/** Keyed off the context object every schema in one parse call already shares. */
		const STATE = "~memo";
		const NO_ISSUES = [];
		function isRef(value) {
			return value !== null && (typeof value === "object" || typeof value === "function");
		}
		function cloneIssues(issues) {
			return issues.map((iss) => iss.path ? {
				...iss,
				path: iss.path.slice()
			} : { ...iss });
		}
		const recursive = /*@__PURE__*/ new WeakMap();
		/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
		const NONE = 0;
		const ASSUMED = 1;
		const PROVEN = 2;
		/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
		function isRecursive(inst, stack, resolve) {
			const cached = recursive.get(inst);
			if (cached !== void 0) return cached ? PROVEN : NONE;
			if (stack.has(inst)) return PROVEN;
			stack.add(inst);
			let result = NONE;
			const check = (child) => {
				if (result !== PROVEN && child?._zod) {
					const answer = isRecursive(child, stack, resolve);
					if (answer > result) result = answer;
				}
			};
			const shape = (sh, spread) => {
				let answer = NONE;
				for (const key of Reflect.ownKeys(sh)) {
					const desc = Object.getOwnPropertyDescriptor(sh, key);
					if (spread && !desc.enumerable) continue;
					const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
					if (child > answer) answer = child;
				}
				return answer;
			};
			const merge = (answer) => {
				if (answer > result) result = answer;
			};
			const def = inst._zod.def;
			switch (def.type) {
				case "object": {
					const raw = rawShape(def);
					merge(raw ? shape(raw, true) : ASSUMED);
					check(def.catchall);
					break;
				}
				case "properties":
					merge(shape(def.shape, false));
					break;
				case "array":
					check(def.element);
					break;
				case "tuple":
					for (const el of def.items) check(el);
					check(def.rest);
					break;
				case "record":
				case "map":
					check(def.keyType);
					check(def.valueType);
					break;
				case "set":
					check(def.valueType);
					break;
				case "union":
					for (const el of def.options) check(el);
					break;
				case "intersection":
					check(def.left);
					check(def.right);
					break;
				case "optional":
				case "nullable":
				case "default":
				case "prefault":
				case "catch":
				case "readonly":
				case "nonoptional":
				case "promise":
				case "success":
					check(def.innerType);
					break;
				case "pipe":
					check(def.in);
					check(def.out);
					break;
				case "function":
					check(def.input);
					check(def.output);
					break;
				case "lazy": {
					const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
					merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
					break;
				}
				case "template_literal":
				case "string":
				case "number":
				case "int":
				case "boolean":
				case "bigint":
				case "symbol":
				case "undefined":
				case "null":
				case "void":
				case "never":
				case "any":
				case "unknown":
				case "date":
				case "nan":
				case "enum":
				case "literal":
				case "file":
				case "transform":
				case "custom": break;
				default: for (const key in def) {
					const desc = Object.getOwnPropertyDescriptor(def, key);
					if (!desc || desc.get) continue;
					const value = desc.value;
					if (!value || typeof value !== "object") continue;
					if (value._zod) check(value);
					else if (Array.isArray(value)) for (const el of value) check(el);
				}
			}
			stack.delete(inst);
			return settle(inst, result);
		}
		/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
		function settle(inst, answer) {
			if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
			return answer;
		}
		function bucketFor(state, inst) {
			let bucket = state.buckets.get(inst);
			if (!bucket) {
				bucket = /* @__PURE__ */ new WeakMap();
				state.buckets.set(inst, bucket);
			}
			return bucket;
		}
		let handoff;
		const open = [];
		const memo = {
			alloc(_inst, payload, empty) {
				const bucket = handoff;
				if (!bucket) return empty;
				handoff = void 0;
				const entry = {
					value: empty,
					issues: null
				};
				bucket.set(payload.value, entry);
				open.push(entry);
				return empty;
			},
			guard(inst) {
				var _a;
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred.push(() => {
					const base = inst._zod.parse;
					const wrapped = (payload, ctx) => {
						if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
						return base(payload, ctx);
					};
					inst._zod.parse = wrapped;
					if (inst._zod.run === base) inst._zod.run = wrapped;
				});
			},
			attach(inst) {
				var _a;
				let isRecursiveInst;
				let rechecked = false;
				let lastCtx;
				let lastBucket;
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred.push(() => {
					const base = inst._zod.parse;
					const wrapped = (payload, ctx) => {
						if (isRecursiveInst === void 0) {
							const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
							if (walked === NONE) {
								inst._zod.parse = base;
								if (inst._zod.run === wrapped) inst._zod.run = base;
								return base(payload, ctx);
							}
							if (walked === PROVEN || rechecked) isRecursiveInst = true;
							else rechecked = true;
						}
						const input = payload.value;
						if (!isRef(input)) return base(payload, ctx);
						let state = ctx[STATE];
						if (!state) {
							state = {
								buckets: /* @__PURE__ */ new WeakMap(),
								backEdges: void 0
							};
							ctx[STATE] = state;
						}
						let bucket;
						if (lastCtx === ctx) bucket = lastBucket;
						else {
							bucket = bucketFor(state, inst);
							lastCtx = ctx;
							lastBucket = bucket;
						}
						const hit = bucket.get(input);
						if (hit) {
							payload.value = hit.value;
							if (hit.issues) {
								if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
							} else {
								payload.memo = true;
								state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
								state.backEdges.add(hit.value);
							}
							return payload;
						}
						handoff = bucket;
						const depth = open.length;
						const result = base(payload, ctx);
						handoff = void 0;
						const entry = open.length > depth ? open.pop() : void 0;
						if (result instanceof Promise) return result.then((r) => {
							if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
							return r;
						});
						if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
						return result;
					};
					inst._zod.parse = wrapped;
					if (inst._zod.run === base) inst._zod.run = wrapped;
				});
			}
		};
		/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
		function memoizer() {
			return memo;
		}
		/** Whether this value is a node a back-edge resolved to before it finished. */
		function isBackEdge(ctx, value) {
			const backEdges = ctx[STATE]?.backEdges;
			return backEdges !== void 0 && isRef(value) && backEdges.has(value);
		}
		//#endregion
		//#region node_modules/zod/v4/locales/en.js
		const error = () => {
			const Sizable = {
				string: {
					unit: "characters",
					verb: "to have"
				},
				file: {
					unit: "bytes",
					verb: "to have"
				},
				array: {
					unit: "items",
					verb: "to have"
				},
				set: {
					unit: "items",
					verb: "to have"
				},
				map: {
					unit: "entries",
					verb: "to have"
				}
			};
			function getSizing(origin) {
				return Sizable[origin] ?? null;
			}
			const FormatDictionary = {
				regex: "input",
				email: "email address",
				url: "URL",
				emoji: "emoji",
				uuid: "UUID",
				uuidv4: "UUIDv4",
				uuidv6: "UUIDv6",
				nanoid: "nanoid",
				guid: "GUID",
				cuid: "cuid",
				cuid2: "cuid2",
				ulid: "ULID",
				xid: "XID",
				ksuid: "KSUID",
				datetime: "ISO datetime",
				date: "ISO date",
				time: "ISO time",
				duration: "ISO duration",
				ipv4: "IPv4 address",
				ipv6: "IPv6 address",
				mac: "MAC address",
				cidrv4: "IPv4 range",
				cidrv6: "IPv6 range",
				base64: "base64-encoded string",
				base64url: "base64url-encoded string",
				json_string: "JSON string",
				e164: "E.164 number",
				credit_card: "credit card number",
				iban: "IBAN",
				jwt: "JWT",
				template_literal: "input"
			};
			const TypeDictionary = { nan: "NaN" };
			function getTypeName(type, input) {
				if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
				return TypeDictionary[type] ?? type;
			}
			return (issue) => {
				switch (issue.code) {
					case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
					case "invalid_value":
						if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
						return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
					case "too_big": {
						const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
						const sizing = getSizing(issue.origin);
						if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
						return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
					}
					case "too_small": {
						const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
						const sizing = getSizing(issue.origin);
						if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
						return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
					}
					case "invalid_format": {
						const _issue = issue;
						if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
						if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
						if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
						if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
						return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
					}
					case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
					case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
					case "invalid_key": return `Invalid key in ${issue.origin}`;
					case "invalid_union":
						if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
						if (issue.inclusive === false) return "Invalid input: more than one option matched";
						return "Invalid input";
					case "invalid_element": return `Invalid value in ${issue.origin}`;
					default: return `Invalid input`;
				}
			};
		};
		function en_default() {
			return { localeError: error() };
		}
		//#endregion
		//#region node_modules/zod/v4/core/registries.js
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		//#endregion
		//#region node_modules/zod/v4/core/api.js
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class({
				type: "string",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class({
				type: "number",
				checks: [],
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						if (!("input" in _issue)) _issue.input = payload.value;
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		//#endregion
		//#region node_modules/zod/v4/core/to-json-schema.js
		function assignProps(target, ...sources) {
			for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
			return target;
		}
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				sharedDefsExtractedFor: void 0,
				sharedEmitDoneFor: void 0,
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				intersections: [],
				deferred: [],
				external: params?.external ?? void 0
			};
		}
		/**
		* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
		* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
		* custom JSON Schema was written into `json`, in which case the caller must not write its own.
		*/
		function handleUnrepresentable(schema, ctx, json, params, message) {
			const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
				zodSchema: schema,
				path: params.path,
				message
			}) : ctx.unrepresentable;
			if (result === "any") return false;
			if (result === void 0 || result === "throw") throw new Error(message);
			Object.assign(json, result);
			return true;
		}
		function processSchema(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			ctx.sharedDefsExtractedFor = void 0;
			ctx.sharedEmitDoneFor = void 0;
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					processSchema(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) assignProps(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function encodeJSONPointerSegment(segment) {
			return segment.replace(/~/g, "~0").replace(/\//g, "~1");
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
					};
				}
				const uriPrefix = `#`;
				const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
				if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + encodeJSONPointerSegment(defId)
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") extractToDef(entry);
				}
			}
			if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
		}
		/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
		function compactTypeUnion(schema) {
			const options = schema.anyOf;
			if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
			const types = [];
			for (const option of options) {
				if (!option || typeof option !== "object") return;
				compactTypeUnion(option);
				const keys = Object.keys(option);
				if (keys.length !== 1 || keys[0] !== "type") return;
				const type = option.type;
				for (const member of Array.isArray(type) ? type : [type]) {
					if (typeof member !== "string") return;
					if (!types.includes(member)) types.push(member);
				}
			}
			delete schema.anyOf;
			schema.type = types.length === 1 ? types[0] : types;
		}
		/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
		* an annotation like `description` — makes a member unfoldable, so a constraint this does not
		* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
		const FOLDABLE_KEYS = /* @__PURE__ */ new Set([
			"type",
			"properties",
			"required",
			"additionalProperties"
		]);
		const UNION_KEYS = ["oneOf", "anyOf"];
		/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
		function undeclaredConstraint(member) {
			const extra = member.additionalProperties;
			if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
			return Object.keys(extra).length ? extra : null;
		}
		/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
		function foldObjects(members) {
			const objects = [];
			for (const member of members) {
				if (typeof member !== "object" || member.type !== "object") return null;
				for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
				objects.push(member);
			}
			const properties = {};
			const required = /* @__PURE__ */ new Set();
			for (const object of objects) {
				for (const key in object.properties) {
					if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
					const parts = [];
					for (const other of objects) {
						const part = other.properties?.[key] ?? undeclaredConstraint(other);
						if (part === null || part === void 0) continue;
						if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
					}
					assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
				}
				for (const key of object.required ?? []) required.add(key);
			}
			const folded = {
				type: "object",
				properties
			};
			if (required.size) folded.required = [...required];
			if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
			else {
				const constraints = [];
				for (const object of objects) {
					const constraint = undeclaredConstraint(object);
					if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
				}
				if (constraints.length === 1) folded.additionalProperties = constraints[0];
				else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
			}
			return folded;
		}
		/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
		* closed object members reject each other's keys and the schema validates nothing. Zod's parser
		* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
		* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
		* into one object is the encoding that says so on every target.
		*
		* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
		* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
		* keeps its reference and its own closedness rather than being inlined as a stale copy. */
		function foldIntersection(json) {
			const allOf = json.allOf;
			if (!Array.isArray(allOf) || allOf.length < 2) return;
			for (const key of FOLDABLE_KEYS) if (key in json) return;
			const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
			let folded = null;
			if (!unions.length) folded = foldObjects(allOf);
			else {
				const union = unions[0];
				const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
				if (Object.keys(union).length !== 1) return;
				const rest = allOf.filter((m) => m !== union);
				const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
				if (branches.some((b) => !b)) return;
				folded = { [keyword]: branches };
			}
			if (!folded) return;
			delete json.allOf;
			assignProps(json, folded);
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else assignProps(schema, refSchema);
					assignProps(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
				for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
				if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
				for (const rewrite of ctx.deferred) rewrite();
				if (ctx.intersections.length) {
					const carriers = /* @__PURE__ */ new Map();
					for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
						const allOf = json?.allOf;
						if (!Array.isArray(allOf)) continue;
						const existing = carriers.get(allOf);
						if (existing) existing.push(json);
						else carriers.set(allOf, [json]);
					}
					for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
				}
			}
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					assignProp(defs, seen.defId, seen.def);
				}
			}
			if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
			if (ctx.external) {} else if (Object.keys(defs).length > 0) {
				if (ctx.target === "draft-2020-12") result.$defs = defs;
				else result.definitions = defs;
			}
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			processSchema(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			processSchema(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		//#endregion
		//#region node_modules/zod/v4/core/json-schema-processors.js
		const narrowMin = (agg, key, value) => {
			if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
		};
		const narrowMax = (agg, key, value) => {
			if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
		};
		const narrowBoth = (agg, value) => {
			narrowMin(agg, "minimum", value);
			narrowMax(agg, "maximum", value);
		};
		const addDivisor = (agg, value) => {
			agg.multipleOf ?? (agg.multipleOf = []);
			if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
		};
		const addPattern = (agg, pattern) => {
			agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
			agg.patterns.add(pattern);
		};
		const intersectMime = (agg, mime) => {
			agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
		};
		const setFormat = (agg, format) => {
			agg.format = format;
			if (format.includes("int")) agg.isInt = true;
		};
		const minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
		const maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
		const formatContributor = (ranges) => (agg, def) => {
			setFormat(agg, def.format);
			const [minimum, maximum] = ranges[def.format];
			narrowMin(agg, "minimum", minimum);
			narrowMax(agg, "maximum", maximum);
		};
		const contributors = {
			greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
			less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
			multiple_of: (agg, def) => addDivisor(agg, def.value),
			number_format: formatContributor(NUMBER_FORMAT_RANGES),
			bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
			min_length: minContributor,
			max_length: maxContributor,
			length_equals: (agg, def) => narrowBoth(agg, def.length),
			min_size: minContributor,
			max_size: maxContributor,
			size_equals: (agg, def) => narrowBoth(agg, def.size),
			string_format: (agg, def) => {
				setFormat(agg, def.format);
				if (def.pattern) addPattern(agg, def.pattern);
				if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
				if (def.local || def.precision === -1) agg.laxFormat = true;
			},
			mime_type: (agg, def) => intersectMime(agg, def.mime)
		};
		function aggregateChecks(schema) {
			const agg = {};
			const def = schema._zod.def;
			const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
			for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
			const bag = schema._zod.bag;
			if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
			if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
			if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
			if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
			if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
			if (bag.format !== void 0) {
				agg.format ?? (agg.format = bag.format);
				if (bag.format.includes("int")) agg.isInt = true;
			}
			if (bag.mime) intersectMime(agg, bag.mime);
			for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
			return agg;
		}
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
		const exactPattern = (p) => exactPatterns.get(p) ?? p;
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time" || laxFormat) delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const patternList = [...patterns].map(exactPattern);
				if (patternList.length === 1) json.pattern = patternList[0].source;
				else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
			json.type = isInt ? "integer" : "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) {
				if (legacy) {
					json.minimum = exclusiveMinimum;
					json.exclusiveMinimum = true;
				} else json.exclusiveMinimum = exclusiveMinimum;
			} else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) {
				if (legacy) {
					json.maximum = exclusiveMaximum;
					json.exclusiveMaximum = true;
				} else json.exclusiveMaximum = exclusiveMaximum;
			} else if (typeof maximum === "number") json.maximum = maximum;
			if (multipleOf) {
				const divisors = /* @__PURE__ */ new Set();
				for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
				else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
				const [first, ...rest] = divisors;
				if (first !== void 0) json.multipleOf = first;
				if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
			}
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.length === 0) {
				json.not = {};
				return;
			}
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const literalProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			if (def.values.length === 0) {
				json.not = {};
				return;
			}
			const vals = [];
			for (const val of def.values) if (val === void 0) {
				if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema")) return;
			} else if (typeof val === "bigint") {
				if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema")) return;
				vals.push(Number(val));
			} else vals.push(val);
			if (vals.length === 0) {} else if (vals.length === 1) {
				const val = vals[0];
				json.type = val === null ? "null" : typeof val;
				if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
				else json.const = val;
			} else {
				if (vals.every((v) => typeof v === "number")) json.type = "number";
				if (vals.every((v) => typeof v === "string")) json.type = "string";
				if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
				if (vals.every((v) => v === null)) json.type = "null";
				json.enum = vals;
			}
		};
		const customProcessor = (schema, ctx, json, params) => {
			handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (schema, ctx, json, params) => {
			handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = aggregateChecks(schema);
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = processSchema(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		function inputOptin(schema) {
			const def = schema._zod.def;
			if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
			if (def.type === "catch") return inputOptin(def.innerType);
			return schema._zod.optin;
		}
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const shape = def.shape;
			if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
			json.type = "object";
			json.properties = {};
			for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			}));
			const allKeys = new Set(Object.keys(shape));
			const requiredKeys = new Set([...allKeys].filter((key) => {
				const field = def.shape[key];
				if (ctx.io === "input") return inputOptin(field) === void 0;
				else return field._zod.optout === void 0;
			}));
			if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => processSchema(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = processSchema(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = processSchema(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
			json.allOf = allOf;
			ctx.intersections.push(allOf);
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
		* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
		* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
		const UNREPRESENTABLE_DEFAULT = Symbol();
		function serializeDefaultValue(value, schema, ctx, json, params) {
			let unrepresentable = false;
			const serialized = JSON.stringify(value, (_, val) => {
				if (typeof val !== "bigint") return val;
				unrepresentable = true;
				return null;
			});
			if (!unrepresentable) return JSON.parse(serialized);
			handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
			return UNREPRESENTABLE_DEFAULT;
		}
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
			if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io !== "input") return;
			const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
			if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
				return;
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			processSchema(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		//#endregion
		//#region node_modules/zod/v4/classic/errors.js
		const _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
		function _lazyMethod(proto, key, make) {
			Object.defineProperty(proto, key, {
				configurable: true,
				enumerable: false,
				get() {
					const value = make(this);
					Object.defineProperty(this, key, {
						value,
						configurable: true,
						writable: true
					});
					return value;
				},
				set(value) {
					Object.defineProperty(this, key, {
						value,
						configurable: true,
						writable: true
					});
				}
			});
		}
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			const proto = Object.getPrototypeOf(inst);
			if (_installedErrorProtos.has(proto)) return;
			_installedErrorProtos.add(proto);
			_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
			_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
			_lazyMethod(proto, "addIssue", (self) => (issue) => {
				self.issues.push(issue);
				self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
			});
			_lazyMethod(proto, "addIssues", (self) => (issues) => {
				self.issues.push(...issues);
				self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
			});
			Object.defineProperty(proto, "isEmpty", {
				configurable: true,
				enumerable: false,
				get() {
					return this.issues.length === 0;
				}
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });
		//#endregion
		//#region node_modules/zod/v4/classic/parse.js
		const parse = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		//#endregion
		//#region node_modules/zod/v4/classic/schemas.js
		function _ensureDefaultLocale() {
			if (!globalConfig.localeError) config(en_default());
		}
		function _ensureDefaultMemoizer() {
			if (!globalConfig.memoizer) config({ memoizer: memoizer() });
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			_ensureDefaultLocale();
			$ZodType.init(inst, def);
			inst.def = def;
			inst.type = def.type;
			return inst;
		}, {
			check(...chks) {
				const def = this.def;
				return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
					check: ch,
					def: { check: "custom" },
					onattach: []
				} } : ch)] }), { parent: true });
			},
			with(...chks) {
				return this.check(...chks);
			},
			clone(def, params) {
				return clone(this, def, params);
			},
			brand() {
				return this;
			},
			register(reg, meta) {
				reg.add(this, meta);
				return this;
			},
			refine(check, params) {
				return this.check(refine(check, params));
			},
			superRefine(refinement, params) {
				return this.check(superRefine(refinement, params));
			},
			overwrite(fn) {
				return this.check(/* @__PURE__ */ _overwrite(fn));
			},
			optional() {
				return optional(this);
			},
			exactOptional() {
				return exactOptional(this);
			},
			nullable() {
				return nullable(this);
			},
			nullish() {
				return optional(nullable(this));
			},
			nonoptional(params) {
				return nonoptional(this, params);
			},
			array() {
				return array(this);
			},
			or(arg) {
				return union([this, arg]);
			},
			and(arg) {
				return intersection(this, arg);
			},
			transform(tx) {
				return pipe(this, transform(tx));
			},
			default(d) {
				return _default(this, d);
			},
			prefault(d) {
				return prefault(this, d);
			},
			catch(params) {
				return _catch(this, params);
			},
			pipe(target) {
				return pipe(this, target);
			},
			readonly() {
				return readonly(this);
			},
			describe(description) {
				const cl = this.clone();
				globalRegistry.add(cl, { description });
				return cl;
			},
			meta(...args) {
				if (args.length === 0) return globalRegistry.get(this);
				const cl = this.clone();
				globalRegistry.add(cl, args[0]);
				return cl;
			},
			isOptional() {
				return this.safeParse(void 0).success;
			},
			isNullable() {
				return this.safeParse(null).success;
			},
			apply(fn, ...args) {
				return args.length === 0 ? fn(this) : fn(this, ...args);
			},
			get "~standard"() {
				return hide(this, "~standard", {
					...standardProps(this),
					jsonSchema: {
						input: createStandardJSONSchemaMethod(this, "input"),
						output: createStandardJSONSchemaMethod(this, "output")
					}
				});
			},
			set "~standard"(value) {
				own(this, "~standard", value);
			},
			parse: function _parse(data, params) {
				return parse(this, data, params, { callee: _parse });
			},
			parseAsync: async function _parseAsync(data, params) {
				return await parseAsync(this, data, params, { callee: _parseAsync });
			},
			safeParse(data, params) {
				return safeParse(this, data, params);
			},
			async safeParseAsync(data, params) {
				return safeParseAsync(this, data, params);
			},
			get spa() {
				return this?.safeParseAsync;
			},
			set spa(value) {
				own(this, "spa", value);
			},
			validate(data, params) {
				return validate(this, data, params);
			},
			validateAsync(data, params) {
				return validateAsync$1(this, data, params);
			},
			encode: function _encode(data, params) {
				return encode(this, data, params, { callee: _encode });
			},
			decode: function _decode(data, params) {
				return decode(this, data, params, { callee: _decode });
			},
			encodeAsync: async function _encodeAsync(data, params) {
				return await encodeAsync(this, data, params, { callee: _encodeAsync });
			},
			decodeAsync: async function _decodeAsync(data, params) {
				return await decodeAsync(this, data, params, { callee: _decodeAsync });
			},
			safeEncode(data, params) {
				return safeEncode(this, data, params);
			},
			safeDecode(data, params) {
				return safeDecode(this, data, params);
			},
			async safeEncodeAsync(data, params) {
				return safeEncodeAsync(this, data, params);
			},
			async safeDecodeAsync(data, params) {
				return safeDecodeAsync(this, data, params);
			},
			toJSONSchema(params) {
				return createToJSONSchemaMethod(this, {})(params);
			},
			get description() {
				return globalRegistry.get(this)?.description;
			},
			get _def() {
				return this._zod.def;
			}
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
		}, /*@__PURE__*/ derived({
			format: (inst) => aggregateChecks(inst).format ?? null,
			minLength: (inst) => aggregateChecks(inst).minimum ?? null,
			maxLength: (inst) => aggregateChecks(inst).maximum ?? null
		}, {
			regex(...args) {
				return this.check(/* @__PURE__ */ _regex(...args));
			},
			includes(...args) {
				return this.check(/* @__PURE__ */ _includes(...args));
			},
			startsWith(...args) {
				return this.check(/* @__PURE__ */ _startsWith(...args));
			},
			endsWith(...args) {
				return this.check(/* @__PURE__ */ _endsWith(...args));
			},
			min(...args) {
				return this.check(/* @__PURE__ */ _minLength(...args));
			},
			max(...args) {
				return this.check(/* @__PURE__ */ _maxLength(...args));
			},
			length(...args) {
				return this.check(/* @__PURE__ */ _length(...args));
			},
			nonempty(...args) {
				return this.check(/* @__PURE__ */ _minLength(1, ...args));
			},
			lowercase(params) {
				return this.check(/* @__PURE__ */ _lowercase(params));
			},
			uppercase(params) {
				return this.check(/* @__PURE__ */ _uppercase(params));
			},
			trim() {
				return this.check(/* @__PURE__ */ _trim());
			},
			normalize(...args) {
				return this.check(/* @__PURE__ */ _normalize(...args));
			},
			toLowerCase() {
				return this.check(/* @__PURE__ */ _toLowerCase());
			},
			toUpperCase() {
				return this.check(/* @__PURE__ */ _toUpperCase());
			},
			slugify() {
				return this.check(/* @__PURE__ */ _slugify());
			}
		}));
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
		}, {
			email(params) {
				return this.check(/* @__PURE__ */ _email(ZodEmail, params));
			},
			url(params) {
				return this.check(/* @__PURE__ */ _url(ZodURL, params));
			},
			jwt(params) {
				return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			},
			emoji(params) {
				return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			},
			guid(params) {
				return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
			},
			uuid(params) {
				return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			},
			uuidv4(params) {
				return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			},
			uuidv6(params) {
				return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			},
			uuidv7(params) {
				return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			},
			nanoid(params) {
				return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			},
			cuid(params) {
				return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			},
			cuid2(params) {
				return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			},
			ulid(params) {
				return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
			},
			base64(params) {
				return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
			},
			base64url(params) {
				return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			},
			xid(params) {
				return this.check(/* @__PURE__ */ _xid(ZodXID, params));
			},
			ksuid(params) {
				return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			},
			ipv4(params) {
				return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			},
			ipv6(params) {
				return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			},
			cidrv4(params) {
				return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			},
			cidrv6(params) {
				return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			},
			e164(params) {
				return this.check(/* @__PURE__ */ _e164(ZodE164, params));
			},
			datetime(params) {
				return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
			},
			date(params) {
				return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
			},
			time(params) {
				return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
			},
			duration(params) {
				return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
			}
		});
		function string(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			inst.isFinite = true;
		}, /*@__PURE__*/ derived({
			minValue: (inst) => {
				const { minimum, exclusiveMinimum } = aggregateChecks(inst);
				return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
			},
			maxValue: (inst) => {
				const { maximum, exclusiveMaximum } = aggregateChecks(inst);
				return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
			},
			isInt: (inst) => {
				const { isInt, multipleOf } = aggregateChecks(inst);
				return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
			},
			format: (inst) => aggregateChecks(inst).format ?? null
		}, {
			gt(value, params) {
				return this.check(/* @__PURE__ */ _gt(value, params));
			},
			gte(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			min(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			lt(value, params) {
				return this.check(/* @__PURE__ */ _lt(value, params));
			},
			lte(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			max(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			int(params) {
				return this.check(int(params));
			},
			safe(params) {
				return this.check(int(params));
			},
			positive(params) {
				return this.check(/* @__PURE__ */ _gt(0, params));
			},
			nonnegative(params) {
				return this.check(/* @__PURE__ */ _gte(0, params));
			},
			negative(params) {
				return this.check(/* @__PURE__ */ _lt(0, params));
			},
			nonpositive(params) {
				return this.check(/* @__PURE__ */ _lte(0, params));
			},
			multipleOf(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			step(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			finite() {
				return this;
			}
		}));
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
		}, {
			min(n, params) {
				return this.check(/* @__PURE__ */ _minLength(n, params));
			},
			nonempty(params) {
				return this.check(/* @__PURE__ */ _minLength(1, params));
			},
			max(n, params) {
				return this.check(/* @__PURE__ */ _maxLength(n, params));
			},
			length(n, params) {
				return this.check(/* @__PURE__ */ _length(n, params));
			},
			unwrap() {
				return this.element;
			}
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
		}, {
			keyof() {
				return _enum(Object.keys(this._zod.def.shape));
			},
			catchall(catchall) {
				return this.clone(mergeDefs(this._zod.def, { catchall }));
			},
			passthrough() {
				return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
			},
			loose() {
				return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
			},
			strict() {
				return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
			},
			strip() {
				return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
			},
			extend(incoming) {
				return extend(this, incoming);
			},
			safeExtend(incoming) {
				return safeExtend(this, incoming);
			},
			merge(other) {
				return merge(this, other);
			},
			pick(mask) {
				return pick(this, mask);
			},
			omit(mask) {
				return omit(this, mask);
			},
			partial(...args) {
				return partial(ZodOptional, this, args[0]);
			},
			exactPartial(...args) {
				return partial(ZodExactOptional, this, args[0], "exactPartial");
			},
			required(...args) {
				return required(ZodNonOptional, this, args[0]);
			}
		});
		function object(shape, params) {
			const def = {
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			};
			return new ZodObject(def);
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = [...inst._zod.values];
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
			return new ZodEnum({
				type: "enum",
				entries,
				...normalizeParams(params)
			});
		}
		const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
			$ZodLiteral.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
			inst.values = new Set(def.values);
			Object.defineProperty(inst, "value", { get() {
				if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
				return def.values[0];
			} });
		});
		function literal(value, params) {
			return new ZodLiteral({
				type: "literal",
				values: Array.isArray(value) ? value : [value],
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						if (!("input" in _issue)) _issue.input = payload.value;
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					return payload;
				});
				payload.value = output;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		//#endregion
		//#region packages/perse-remote-dev/lib/typert.remote-client.js
		const perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema = object({ "hostId": string().readonly() });
		const perse_remote_dev_remoteDev_closeTunnel_result$schema = object({
			"hostId": string().readonly(),
			"closed": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_createDirectory_parameter_0$schema = object({
			"location": object({
				"target": object({ "hostId": string().readonly() }).readonly(),
				"path": string().readonly(),
				"token": string().readonly()
			}).readonly(),
			"name": string().readonly()
		});
		const perse_remote_dev_remoteDev_createDirectory_result$schema = object({
			"target": object({ "hostId": string().readonly() }).readonly(),
			"path": string().readonly(),
			"token": string().readonly()
		});
		const perse_remote_dev_remoteDev_describe_parameter_0$schema = object({ "includeEndpoints": boolean().readonly() });
		const perse_remote_dev_remoteDev_describe_result$schema = object({
			"package": string().readonly(),
			"face": string().readonly(),
			"serviceKey": string().readonly(),
			"namespace": string().readonly(),
			"endpoints": array(string()).readonly(),
			"revision": string().readonly(),
			"protocolModule": string().readonly(),
			"cordisModule": string().readonly(),
			"node": string().readonly()
		});
		const perse_remote_dev_remoteDev_listDirectory_parameter_0$schema = object({
			"target": object({ "hostId": string().readonly() }).readonly(),
			"path": string().readonly()
		});
		const perse_remote_dev_remoteDev_listDirectory_result$schema = object({
			"target": object({ "hostId": string().readonly() }).readonly(),
			"host": string().readonly(),
			"path": string().readonly(),
			"parent": string().readonly().optional(),
			"home": string().readonly(),
			"location": object({
				"target": object({ "hostId": string().readonly() }).readonly(),
				"path": string().readonly(),
				"token": string().readonly()
			}).readonly(),
			"entries": array(object({
				"name": string().readonly(),
				"path": string().readonly(),
				"hidden": boolean().readonly(),
				"location": object({
					"target": object({ "hostId": string().readonly() }).readonly(),
					"path": string().readonly(),
					"token": string().readonly()
				}).readonly()
			})).readonly()
		});
		const perse_remote_dev_remoteDev_listTargets_parameter_0$schema = object({
			"includeAll": boolean().readonly(),
			"probe": boolean().readonly(),
			"fresh": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_listTargets_result$schema = object({
			"targets": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"kind": union([literal("local"), literal("ssh")]).readonly(),
				"state": union([
					literal("connected"),
					literal("connecting"),
					literal("reconnecting"),
					literal("disconnected"),
					literal("unknown")
				]).readonly(),
				"detail": string().readonly(),
				"hostName": string().readonly(),
				"user": string().readonly(),
				"port": string().readonly(),
				"proxyJump": string().readonly(),
				"aliases": array(string()).readonly(),
				"jump": boolean().readonly(),
				"configured": boolean().readonly()
			})).readonly(),
			"configuredOnly": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_listTunnels_parameter_0$schema = object({ "includeDead": boolean().readonly() });
		const perse_remote_dev_remoteDev_listTunnels_result$schema = object({ "tunnels": array(object({
			"hostId": string().readonly(),
			"url": string().readonly(),
			"localPort": number().readonly(),
			"remotePort": string().readonly(),
			"alive": boolean().readonly(),
			"openedAt": number().readonly(),
			"refreshedAt": number().readonly(),
			"authenticated": boolean().readonly(),
			"warning": string().readonly().optional()
		})).readonly() });
		const perse_remote_dev_remoteDev_openProject_parameter_0$schema = object({
			"location": object({
				"target": object({ "hostId": string().readonly() }).readonly(),
				"path": string().readonly(),
				"token": string().readonly()
			}).readonly(),
			"remember": boolean().readonly(),
			"requireAuthentication": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_openProject_result$schema = object({
			"target": object({ "hostId": string().readonly() }).readonly(),
			"host": string().readonly(),
			"path": string().readonly(),
			"url": string().readonly(),
			"localPort": number().readonly(),
			"remotePort": string().readonly(),
			"reused": boolean().readonly(),
			"authenticated": boolean().readonly(),
			"saved": boolean().readonly(),
			"warning": string().readonly().optional()
		});
		const perse_remote_dev_remoteDev_openTunnel_parameter_0$schema = object({
			"target": object({ "hostId": string().readonly() }).readonly(),
			"requireAuthentication": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_openTunnel_result$schema = object({
			"hostId": string().readonly(),
			"url": string().readonly(),
			"localPort": number().readonly(),
			"remotePort": string().readonly(),
			"alive": boolean().readonly(),
			"openedAt": number().readonly(),
			"refreshedAt": number().readonly(),
			"authenticated": boolean().readonly(),
			"warning": string().readonly().optional()
		});
		const perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema = object({ "includeCandidates": boolean().readonly() });
		const perse_remote_dev_remoteDev_readConfiguration_result$schema = object({
			"hosts": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"address": string().readonly(),
				"port": string().readonly(),
				"username": string().readonly(),
				"auth": string().readonly(),
				"keyPath": string().readonly(),
				"passwordRef": string().readonly(),
				"fromAlias": string().readonly(),
				"projectPath": string().readonly(),
				"remotePort": string().readonly(),
				"projects": array(string()).readonly()
			})).readonly(),
			"migrated": boolean().readonly(),
			"enginePath": string().readonly(),
			"resolved": object({
				"host": string().readonly(),
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly()
			}).readonly(),
			"configured": boolean().readonly(),
			"missing": array(string()).readonly(),
			"hint": string().readonly(),
			"candidates": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"kind": union([literal("local"), literal("ssh")]).readonly(),
				"state": union([
					literal("connected"),
					literal("connecting"),
					literal("reconnecting"),
					literal("disconnected"),
					literal("unknown")
				]).readonly(),
				"detail": string().readonly(),
				"hostName": string().readonly(),
				"user": string().readonly(),
				"port": string().readonly(),
				"proxyJump": string().readonly(),
				"aliases": array(string()).readonly(),
				"jump": boolean().readonly(),
				"configured": boolean().readonly()
			})).readonly()
		});
		const perse_remote_dev_remoteDev_reviewApply_parameter_0$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"files": array(string()).readonly(),
			"base": string().readonly(),
			"verify": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_reviewApply_result$schema = object({
			"ok": boolean().readonly(),
			"failedAt": string().readonly().optional(),
			"steps": array(object({
				"step": string().readonly(),
				"code": number().readonly(),
				"output": string().readonly()
			})).readonly(),
			"base": string().readonly(),
			"head": string().readonly(),
			"files": array(string()).readonly(),
			"verified": boolean().readonly(),
			"note": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"base": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewBatch_result$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"engine": string().readonly(),
			"base": string().readonly(),
			"head": string().readonly(),
			"files": array(object({
				"path": string().readonly(),
				"add": number().readonly().optional(),
				"del": number().readonly().optional(),
				"status": union([
					literal("A"),
					literal("M"),
					literal("D")
				]).readonly()
			})).readonly(),
			"diff": string().readonly(),
			"empty": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_reviewReject_parameter_0$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"files": array(string()).readonly(),
			"base": string().readonly(),
			"comment": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewReject_result$schema = object({
			"ts": string().readonly(),
			"kind": string().readonly(),
			"host": string().readonly(),
			"base": string().readonly(),
			"files": array(string()).readonly(),
			"comment": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"ref": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewRollback_result$schema = object({
			"ok": boolean().readonly(),
			"code": number().readonly(),
			"ref": string().readonly(),
			"output": string().readonly(),
			"note": string().readonly()
		});
		const perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema = object({ "target": object({
			"hostId": string().readonly(),
			"projectPath": string().readonly(),
			"mDir": string().readonly(),
			"hub": string().readonly(),
			"verifyCmd": string().readonly(),
			"token": string().readonly().optional()
		}).readonly() });
		const perse_remote_dev_remoteDev_reviewStatus_result$schema = object({
			"target": object({
				"hostId": string().readonly(),
				"projectPath": string().readonly(),
				"mDir": string().readonly(),
				"hub": string().readonly(),
				"verifyCmd": string().readonly(),
				"token": string().readonly().optional()
			}).readonly(),
			"base": string().readonly().optional(),
			"head": string().readonly().optional(),
			"dirty": number().readonly(),
			"missing": boolean().readonly()
		});
		const perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema = object({
			"hosts": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"address": string().readonly(),
				"port": string().readonly(),
				"username": string().readonly(),
				"auth": string().readonly(),
				"keyPath": string().readonly(),
				"passwordRef": string().readonly(),
				"fromAlias": string().readonly(),
				"projectPath": string().readonly(),
				"remotePort": string().readonly(),
				"projects": array(string()).readonly()
			})).readonly(),
			"projectPath": string().readonly(),
			"mDir": string().readonly(),
			"hub": string().readonly(),
			"enginePath": string().readonly()
		});
		const perse_remote_dev_remoteDev_updateConfiguration_result$schema = object({
			"configured": boolean().readonly(),
			"missing": array(string()).readonly()
		});
		const TYPERT_REMOTE = {
			package: "perse-remote-dev",
			descriptors: [
				{
					id: "perse-remote-dev#remoteDev/closeTunnel",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "closeTunnel",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteCloseTunnelRequest",
							schema: perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelClosedValue",
						schema: perse_remote_dev_remoteDev_closeTunnel_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 482,
						"column": 3
					}
				},
				{
					id: "perse-remote-dev#remoteDev/createDirectory",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "createDirectory",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteMkdirRequest",
							schema: perse_remote_dev_remoteDev_createDirectory_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteWorkspaceLocation",
						schema: perse_remote_dev_remoteDev_createDirectory_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 370,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/describe",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "describe",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteDescribeRequest",
							schema: perse_remote_dev_remoteDev_describe_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteServiceDescription",
						schema: perse_remote_dev_remoteDev_describe_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 699,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/listDirectory",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "listDirectory",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteListRequest",
							schema: perse_remote_dev_remoteDev_listDirectory_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteDirectoryListing",
						schema: perse_remote_dev_remoteDev_listDirectory_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 336,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/listTargets",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "listTargets",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTargetsRequest",
							schema: perse_remote_dev_remoteDev_listTargets_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTargetsValue",
						schema: perse_remote_dev_remoteDev_listTargets_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 221,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/listTunnels",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "listTunnels",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelListRequest",
							schema: perse_remote_dev_remoteDev_listTunnels_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelListValue",
						schema: perse_remote_dev_remoteDev_listTunnels_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 470,
						"column": 3
					}
				},
				{
					id: "perse-remote-dev#remoteDev/openProject",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "openProject",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteOpenProjectRequest",
							schema: perse_remote_dev_remoteDev_openProject_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteOpenedProject",
						schema: perse_remote_dev_remoteDev_openProject_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 400,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/openTunnel",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "openTunnel",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelRequest",
							schema: perse_remote_dev_remoteDev_openTunnel_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelView",
						schema: perse_remote_dev_remoteDev_openTunnel_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 444,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/readConfiguration",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "readConfiguration",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationRequest",
							schema: perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteConfigurationValue",
						schema: perse_remote_dev_remoteDev_readConfiguration_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 263,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/reviewApply",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "reviewApply",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewApplyRequest",
							schema: perse_remote_dev_remoteDev_reviewApply_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewApplyResult",
						schema: perse_remote_dev_remoteDev_reviewApply_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 546,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/reviewBatch",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "reviewBatch",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewBatchRequest",
							schema: perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewBatch",
						schema: perse_remote_dev_remoteDev_reviewBatch_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 520,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/reviewReject",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "reviewReject",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRejectRequest",
							schema: perse_remote_dev_remoteDev_reviewReject_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteDecisionRecord",
						schema: perse_remote_dev_remoteDev_reviewReject_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 648,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/reviewRollback",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "reviewRollback",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRollbackRequest",
							schema: perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewRollbackResult",
						schema: perse_remote_dev_remoteDev_reviewRollback_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 671,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/reviewStatus",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "reviewStatus",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewStatusRequest",
							schema: perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewStatus",
						schema: perse_remote_dev_remoteDev_reviewStatus_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 501,
						"column": 9
					}
				},
				{
					id: "perse-remote-dev#remoteDev/updateConfiguration",
					service: "remoteDev",
					namespace: "remoteDev",
					method: "updateConfiguration",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						wire: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationUpdate",
							schema: perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteConfigurationUpdateValue",
						schema: perse_remote_dev_remoteDev_updateConfiguration_result$schema
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 298,
						"column": 9
					}
				}
			]
		};
		//#endregion
		//#region packages/perse-remote-dev/src/client/model.ts
		/** The five link-state words the host vocabulary defines. */
		const STATE_LABEL = {
			connected: "已连接",
			connecting: "连接中",
			reconnecting: "重连中",
			disconnected: "已断开",
			unknown: "未探测"
		};
		/**
		* Flatten one `RemoteFailure` for the UI.
		*
		* Callers discriminate with the canonical `if (!result.ok)` branch —
		* `instanceof` is never used, and the branch narrows `error.details` for free.
		* @param error - the failure half of a `RemoteResult`.
		* @returns the UI-shaped failure.
		*/
		function toFailure(error) {
			return {
				code: error.code,
				message: error.message,
				details: error.details
			};
		}
		function okOutcome(value) {
			return {
				ok: true,
				value
			};
		}
		function failedOutcome(failure) {
			return {
				ok: false,
				failure
			};
		}
		/**
		* Minimal observable cell: the framework's slot-store contract is not reachable
		* from this workspace, so the model exposes a `getSnapshot`/`subscribe` pair and
		* the components bind it through the inject face's hooks. The instance lives on
		* this per-apply model (object layer), never at module scope.
		*/
		var Cell = class {
			value;
			listeners = /* @__PURE__ */ new Set();
			/** @param initial - first snapshot value. */
			constructor(initial) {
				this.value = initial;
			}
			/** @returns the current snapshot. */
			get = () => this.value;
			/**
			* @param listener - change callback.
			* @returns unsubscribe function.
			*/
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/** @param next - replacement snapshot. */
			set(next) {
				this.value = next;
				for (const listener of [...this.listeners]) listener();
			}
			/** @param patch - partial snapshot merged over the current one. */
			patch(patch) {
				this.set({
					...this.value,
					...patch
				});
			}
		};
		/** Local fallback, mirroring the host's own `localView()`. */
		const LOCAL_VIEW = {
			id: "local",
			name: "本机",
			kind: "local",
			state: "connected",
			detail: "",
			hostName: "",
			user: "",
			port: "",
			proxyJump: "",
			aliases: [],
			jump: false,
			configured: true
		};
		/** Empty host record used by the settings form's "add host" action. */
		function blankHost(id) {
			return {
				id,
				name: "",
				address: "",
				port: "22",
				username: "",
				auth: "agent",
				keyPath: "",
				passwordRef: "",
				fromAlias: "",
				projectPath: "",
				remotePort: "3080",
				projects: []
			};
		}
		/** The five slots this plugin occupies, in registration order. */
		const SLOT_NAMES = [
			"conversation.session.header.actions",
			"settings.section",
			"conversation.hero.workspace.directoryFlow",
			"sidebar.workspaces.directoryFlow",
			"shell.overlay"
		];
		/** Remote-workspace client model. */
		var RemoteWorkspaceClient = class {
			hosts = new Cell({
				status: "idle",
				targets: [LOCAL_VIEW],
				configuredOnly: false,
				probed: false,
				failure: null
			});
			config = new Cell({
				status: "idle",
				value: null,
				failure: null
			});
			hostFace = new Cell({
				status: "idle",
				value: null,
				failure: null
			});
			tunnels = new Cell({
				status: "idle",
				tunnels: [],
				failure: null
			});
			review = new Cell({
				status: "idle",
				batch: null,
				target: null,
				failure: null,
				busy: false,
				applyResult: null,
				note: "待审阅"
			});
			/** Which of {@link SLOT_NAMES} have actually had their declaration observed. */
			slots = new Cell(Object.fromEntries(SLOT_NAMES.map((name) => [name, false])));
			ctx;
			/** @param ctx - the consumer plugin's context (carries `remote.remoteDev`). */
			constructor(ctx) {
				this.ctx = ctx;
			}
			/** Mark one slot declaration observed (called from each `slots.inject` callback). */
			markSlot(name) {
				this.slots.patch({ [name]: true });
			}
			/** @returns the sibling-list diagnostics snapshot. */
			diagnostics() {
				return {
					describe: this.hostFace.get().status === "ready" ? "ok" : this.hostFace.get().status === "error" ? "error" : "idle",
					targets: this.hosts.get().status === "ready" ? "ok" : this.hosts.get().status === "error" ? "error" : "idle",
					config: this.config.get().status === "ready" ? "ok" : this.config.get().status === "error" ? "error" : "idle",
					endpoints: this.hostFace.get().value?.endpoints.length ?? 0,
					revision: this.hostFace.get().value?.revision ?? "",
					targetsCount: this.hosts.get().targets.length,
					slots: this.slots.get()
				};
			}
			/**
			* Read the host inventory. `probe` spawns one short ssh per ssh host, so it is
			* an explicit user action — the host has no event stream, and the model must
			* not pretend it has a subscription.
			* @param options - probe / cache-bypass switches.
			*/
			async loadTargets(options = {}) {
				this.hosts.patch({
					status: "loading",
					failure: null
				});
				const probe = options.probe === true;
				const fresh = options.fresh === true;
				const [configuredResult, allResult] = await Promise.all([this.ctx.remote.remoteDev.listTargets({
					includeAll: false,
					probe,
					fresh
				}), this.ctx.remote.remoteDev.listTargets({
					includeAll: true,
					probe: false,
					fresh
				})]);
				if (!configuredResult.ok) {
					this.hosts.patch({
						status: "error",
						failure: toFailure(configuredResult.error)
					});
					return;
				}
				if (!allResult.ok) {
					this.hosts.patch({
						status: "error",
						failure: toFailure(allResult.error)
					});
					return;
				}
				const configured = configuredResult.value.targets;
				const known = new Set(configured.map((target) => target.id));
				const extras = allResult.value.targets.filter((target) => target.kind === "ssh" && !known.has(target.id));
				this.hosts.set({
					failure: null,
					status: "ready",
					targets: [...configured, ...extras.map((target) => ({
						...target,
						configured: false
					}))],
					configuredOnly: configuredResult.value.configuredOnly,
					probed: probe
				});
			}
			/** @returns hosts the user configured (plus the always-present local target). */
			selectableHosts(showAll) {
				const targets = this.hosts.get().targets;
				return showAll ? targets : targets.filter((t) => t.kind === "local" || t.configured);
			}
			/** @returns how many `~/.ssh/config`-only hosts the "more hosts" escape hides. */
			extraHostCount() {
				return this.hosts.get().targets.filter((t) => t.kind === "ssh" && !t.configured).length;
			}
			/** @returns the host record for one id, falling back to the local view. */
			hostOf(hostId) {
				return this.hosts.get().targets.find((t) => t.id === hostId) ?? LOCAL_VIEW;
			}
			/**
			* Resolve the badge host from **real** data: the effective configuration's
			* resolved target (`readConfiguration`) joined against the live target list
			* (`listTargets`). When nothing is configured the local view is the honest
			* answer. There is no session→host model in the host face (no G-09 identity),
			* so this is "the configured target", not "the session's workspace host".
			* @returns the active host projection.
			*/
			activeHost() {
				const resolved = this.config.get().value?.resolved;
				const hostId = resolved !== void 0 && resolved.hostId !== "" ? resolved.hostId : "local";
				const view = this.hostOf(hostId);
				return {
					id: view.id,
					name: view.name,
					state: view.state,
					detail: view.detail
				};
			}
			/** Read the effective configuration plus `~/.ssh/config` import candidates. */
			async loadConfig() {
				this.config.patch({
					status: "loading",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.readConfiguration({ includeCandidates: true });
				if (!result.ok) {
					this.config.patch({
						status: "error",
						failure: toFailure(result.error)
					});
					return;
				}
				this.config.set({
					status: "ready",
					value: result.value,
					failure: null
				});
			}
			/**
			* Persist host records and the scalar target chain.
			* @param hosts - full replacement list of host records.
			* @param scalars - chain fields; empty strings mean "leave unchanged" (host contract).
			*/
			async saveConfig(hosts, scalars) {
				const result = await this.ctx.remote.remoteDev.updateConfiguration({
					hosts: [...hosts],
					projectPath: scalars.projectPath,
					mDir: scalars.mDir,
					hub: scalars.hub,
					enginePath: scalars.enginePath
				});
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome({
					configured: result.value.configured,
					missing: result.value.missing
				});
			}
			/** Ask the host face to describe itself (runtime self-proof, G-11). */
			async loadHostFace() {
				this.hostFace.patch({
					status: "loading",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.describe({ includeEndpoints: true });
				if (!result.ok) {
					this.hostFace.patch({
						status: "error",
						failure: toFailure(result.error)
					});
					return;
				}
				this.hostFace.set({
					status: "ready",
					value: result.value,
					failure: null
				});
			}
			/** Read the live tunnel registry. */
			async loadTunnels() {
				this.tunnels.patch({
					status: "loading",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.listTunnels({ includeDead: false });
				if (!result.ok) {
					this.tunnels.patch({
						status: "error",
						failure: toFailure(result.error)
					});
					return;
				}
				this.tunnels.set({
					status: "ready",
					tunnels: result.value.tunnels,
					failure: null
				});
			}
			/**
			* Open (or reuse) a tunnel to one ssh host.
			* @param hostId - configured id or alias.
			* @param requireAuthentication - ask the host to fail rather than degrade when no token is available.
			*/
			async openTunnel(hostId, requireAuthentication) {
				const result = await this.ctx.remote.remoteDev.openTunnel({
					target: { hostId },
					requireAuthentication
				});
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome(result.value);
			}
			/**
			* Close one host's tunnel.
			* @param hostId - configured id or alias.
			*/
			async closeTunnel(hostId) {
				const result = await this.ctx.remote.remoteDev.closeTunnel({ hostId });
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome(result.value);
			}
			/**
			* List one directory. The returned `location` (and every `entries[].location`)
			* carries the host-issued proof that mutating verbs must echo back verbatim;
			* the client never builds a `{ hostId, path }` pair on its own.
			* @param hostId - target host id (`local` or a configured id / alias).
			* @param path - absolute path; empty means that host's home directory.
			*/
			async listDirectory(hostId, path) {
				const result = await this.ctx.remote.remoteDev.listDirectory({
					target: { hostId },
					path
				});
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome(result.value);
			}
			/**
			* Create one directory inside a listing's location.
			* @param location - the host-issued location proof.
			* @param name - new directory name.
			*/
			async createDirectory(location, name) {
				const result = await this.ctx.remote.remoteDev.createDirectory({
					location,
					name
				});
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome(result.value);
			}
			/**
			* Register a remote project and open that machine's DSH through a tunnel.
			* @param location - the host-issued location proof.
			* @param remember - ask the host to persist the project on the host record.
			* @param requireAuthentication - ask for a token-bearing URL or a typed failure.
			*/
			async openProject(location, remember, requireAuthentication) {
				const result = await this.ctx.remote.remoteDev.openProject({
					location,
					remember,
					requireAuthentication
				});
				if (!result.ok) return failedOutcome(toFailure(result.error));
				return okOutcome(result.value);
			}
			/** Read the review status. The host fills any blank target field from its own chain. */
			async reviewStatus() {
				this.review.patch({
					status: "loading",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.reviewStatus({ target: {
					hostId: "",
					projectPath: "",
					mDir: "",
					hub: "",
					verifyCmd: ""
				} });
				if (!result.ok) {
					this.review.patch({
						status: "error",
						failure: toFailure(result.error)
					});
					return;
				}
				this.review.patch({
					status: "ready",
					target: result.value.target,
					note: result.value.missing ? "镜像缺失" : `${result.value.dirty} 个改动`,
					failure: null
				});
			}
			/** Fetch one review batch (ssh + engine round trip; user-initiated only). */
			async reviewBatch() {
				this.review.patch({
					status: "loading",
					busy: true,
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.reviewBatch({
					target: {
						hostId: "",
						projectPath: "",
						mDir: "",
						hub: "",
						verifyCmd: ""
					},
					base: ""
				});
				if (!result.ok) {
					this.review.patch({
						status: "error",
						busy: false,
						failure: toFailure(result.error)
					});
					return;
				}
				this.review.patch({
					status: "ready",
					busy: false,
					batch: result.value,
					target: result.value.target,
					failure: null,
					note: result.value.empty ? "没有待审批次" : `${result.value.files.length} 个文件待审`
				});
			}
			/**
			* Approve files. Step failures arrive as `ok:false` **values** with a step
			* trail, not as Remote error codes.
			* @param files - selected file paths.
			* @param verify - run the target's verification command.
			*/
			async reviewApply(files, verify) {
				const target = this.review.get().target;
				if (target === null) return;
				this.review.patch({
					busy: true,
					note: "提交中…",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.reviewApply({
					target,
					files: [...files],
					base: this.review.get().batch?.base ?? "",
					verify
				});
				if (!result.ok) {
					this.review.patch({
						busy: false,
						failure: toFailure(result.error),
						note: result.error.message
					});
					return;
				}
				this.review.patch({
					busy: false,
					applyResult: result.value,
					note: result.value.ok ? "已应用并推进基线" : `步骤失败：${result.value.failedAt ?? "未知"}`
				});
				await this.reviewBatch();
			}
			/**
			* Record a rejection (append-only decision ledger).
			* @param files - rejected file paths.
			* @param comment - required rejection reason.
			*/
			async reviewReject(files, comment) {
				const target = this.review.get().target;
				if (target === null) return;
				this.review.patch({
					busy: true,
					note: "记录中…",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.reviewReject({
					target,
					files: [...files],
					base: this.review.get().batch?.base ?? "",
					comment
				});
				if (!result.ok) {
					this.review.patch({
						busy: false,
						failure: toFailure(result.error),
						note: result.error.message
					});
					return;
				}
				this.review.patch({
					busy: false,
					note: `拒因已留痕：${result.value.comment}`
				});
			}
			/**
			* Roll the hub baseline back to a ref.
			* @param ref - commit to roll back to.
			*/
			async reviewRollback(ref) {
				const target = this.review.get().target;
				if (target === null) return;
				this.review.patch({
					busy: true,
					note: "回滚中…",
					failure: null
				});
				const result = await this.ctx.remote.remoteDev.reviewRollback({
					target,
					ref
				});
				if (!result.ok) {
					this.review.patch({
						busy: false,
						failure: toFailure(result.error),
						note: result.error.message
					});
					return;
				}
				this.review.patch({
					busy: false,
					note: `${result.value.note}（${result.value.ref.slice(0, 8)}）`
				});
				await this.reviewBatch();
			}
		};
		//#endregion
		//#region packages/perse-remote-dev/src/client/components.ts
		/**
		* Browser-half components.
		*
		* Components never touch `ctx`: every read comes from a
		* hook projected by the registration's `inject` factory and every write goes
		* through an action on that same face. All markup is `React.createElement`
		* because the dynamic-package shape cannot import the design-system components.
		*
		* The `data-rws-*` attributes are the frozen public test contract; the extra
		* `data-testid` seats are additive and never replace them.
		*/
		const h = react.createElement;
		/** Bind a model cell to a component-local snapshot state. */
		function useCell(cell) {
			const [snapshot, setSnapshot] = react.useState(cell.get);
			react.useEffect(() => cell.subscribe(() => setSnapshot(cell.get())), [cell]);
			return snapshot;
		}
		/** One coloured link-state dot. */
		function Dot(state) {
			return h("span", {
				className: "rws_dot",
				"data-state": state
			});
		}
		/**
		* Session-header host badge.
		*
		* Renders the host that the **effective configuration
		* resolves to** (real `readConfiguration` data) joined with that host's live
		* `listTargets` link state — falling back to the local view only when nothing
		* is configured. A hard-coded `find(id === 'local')` would pin the badge to 本机
		* forever, which is exactly what this component exists to avoid. There is no
		* session→host identity in the host face, so this is deliberately "the
		* configured target", never a fabricated session fact.
		* @param props - badge face.
		* @returns badge element.
		*/
		function HostBadge(props) {
			const host = props.useActiveHost();
			return h("span", {
				className: "rws_badge",
				"data-rws-host": host.id,
				"data-rws-state": host.state,
				"data-testid": "rws.session.hostBadge",
				title: `当前工作区所在主机：${host.detail === "" ? host.name : host.detail}`
			}, Dot(host.state), h("span", {
				className: "rws_host",
				"data-testid": "rws.session.hostName"
			}, host.name), h("span", { className: "rws_sep" }, "·"), h("span", { "data-testid": "rws.session.hostState" }, STATE_LABEL[host.state]));
		}
		const HOST_FIELDS = [
			{
				key: "name",
				label: "名称",
				placeholder: "例如 my-remote-host"
			},
			{
				key: "address",
				label: "网络地址",
				placeholder: "IP 或主机名"
			},
			{
				key: "port",
				label: "端口",
				placeholder: "22"
			},
			{
				key: "username",
				label: "用户名",
				placeholder: "例如 root"
			},
			{
				key: "auth",
				label: "登陆方式",
				placeholder: "",
				options: [
					{
						value: "agent",
						label: "SSH 密钥 / agent"
					},
					{
						value: "key",
						label: "指定私钥文件"
					},
					{
						value: "password",
						label: "密码"
					}
				]
			},
			{
				key: "projectPath",
				label: "项目路径（可选）",
				placeholder: "/home/me/proj"
			},
			{
				key: "remotePort",
				label: "远端 DSH 端口",
				placeholder: "3080"
			}
		];
		const EMPTY_SCALARS = {
			projectPath: "",
			mDir: "",
			hub: "",
			enginePath: ""
		};
		/** Read one host field as an editable string. */
		function hostFieldValue(host, key) {
			const value = host[key];
			return typeof value === "string" ? value : "";
		}
		/**
		* 「设置 › 远程开发」 — host connections plus the review-chain scalars.
		*
		* Reads: `readConfiguration` (hosts, candidates, resolved chain), `describe`
		* (host-face revision + endpoint count), `listTunnels` (live tunnels), and
		* `listTargets` (so the badge/flow share one inventory). Writes:
		* `updateConfiguration`, `openTunnel`, `closeTunnel`.
		* @param props - settings face.
		* @returns section element.
		*/
		function RemoteDevSection(props) {
			const config = props.useConfig();
			const hostFace = props.useHostFace();
			const tunnels = props.useTunnels();
			const hosts = props.useHosts();
			const [draft, setDraft] = react.useState([]);
			const [scalars, setScalars] = react.useState(EMPTY_SCALARS);
			const [message, setMessage] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const seeded = react.useRef(false);
			const value = config.value;
			react.useEffect(() => {
				if (value === null || seeded.current) return;
				seeded.current = true;
				setDraft(value.hosts.map((host) => ({ ...host })));
				setScalars({
					projectPath: "",
					mDir: value.resolved.mDir,
					hub: value.resolved.hub,
					enginePath: value.enginePath
				});
			}, [value]);
			const edit = (index, key, next) => {
				setDraft((current) => current.map((host, i) => i === index ? {
					...host,
					[key]: next
				} : host));
			};
			const addHost = () => {
				setDraft((current) => [...current, blankHost(`host-${Date.now().toString(36)}`)]);
			};
			const importAlias = (candidate) => {
				setDraft((current) => [...current, {
					id: candidate.id,
					name: candidate.id,
					address: candidate.hostName === "" ? candidate.id : candidate.hostName,
					port: candidate.port === "" ? "22" : candidate.port,
					username: candidate.user,
					auth: "agent",
					keyPath: "",
					passwordRef: "",
					fromAlias: candidate.id,
					projectPath: "",
					remotePort: "3080",
					projects: []
				}]);
			};
			const save = async () => {
				setBusy(true);
				setMessage("保存中…");
				const outcome = await props.saveConfig(draft, scalars);
				setBusy(false);
				if (!outcome.ok) {
					setMessage(`保存失败：${props.failureText(outcome.failure)}`);
					return;
				}
				setMessage(outcome.value.configured ? "已保存（已就绪）" : `已保存；还缺：${outcome.value.missing.join("、")}`);
				props.loadConfig();
				props.loadTargets();
			};
			const openRemote = async (host) => {
				setMessage(`正在连接 ${host.name === "" ? host.id : host.name} …`);
				const outcome = await props.openTunnel(host.fromAlias === "" ? host.id : host.fromAlias, true);
				if (!outcome.ok) {
					setMessage(`连接失败：${props.failureText(outcome.failure)}`);
					return;
				}
				setMessage(`隧道就绪 127.0.0.1:${outcome.value.localPort}`);
				try {
					window.open(outcome.value.url, "_blank", "noopener");
				} catch {}
				props.loadTunnels();
			};
			const closeTunnel = async (hostId) => {
				const outcome = await props.closeTunnel(hostId);
				setMessage(outcome.ok ? `隧道已关闭：${outcome.value.hostId}` : `关闭失败：${props.failureText(outcome.failure)}`);
				props.loadTunnels();
			};
			const field = (index, spec) => {
				const host = draft[index];
				if (host === void 0) return null;
				const input = spec.options === void 0 ? h("input", {
					className: "rws-fld-input",
					value: hostFieldValue(host, spec.key),
					placeholder: spec.placeholder,
					"data-testid": `rws.settings.field.${String(spec.key)}`,
					onChange: (event) => edit(index, spec.key, event.target.value)
				}) : h("select", {
					className: "rws-fld-input",
					value: hostFieldValue(host, spec.key),
					"data-testid": `rws.settings.field.${String(spec.key)}`,
					onChange: (event) => edit(index, spec.key, event.target.value)
				}, ...spec.options.map((option) => h("option", {
					key: option.value,
					value: option.value
				}, option.label)));
				return h("label", {
					key: String(spec.key),
					className: "rws-fld"
				}, h("span", { className: "rws-fld-label" }, spec.label), input);
			};
			const kids = [];
			kids.push(h("p", {
				key: "lead",
				className: "rws-lead"
			}, "添加你要连接的远端主机。填好地址与登陆方式后，创建项目时就能选到它。"));
			if (config.status === "loading") kids.push(h("p", {
				key: "ld",
				className: "rws-dim"
			}, "读取中…"));
			if (config.status === "error" && config.failure !== null) kids.push(h("p", {
				key: "er",
				className: "rws-err",
				"data-rws-error": config.failure.code
			}, `读取配置失败：${props.failureText(config.failure)}`));
			if (config.status === "ready" && value !== null) {
				kids.push(h("div", {
					key: "status",
					className: "rws-status",
					"data-testid": "rws.settings.status",
					"data-rws-configured": value.configured ? "1" : "0",
					"data-rws-missing": value.missing.join(",")
				}, h("span", { className: value.configured ? "rws-dot rws-dot-on" : "rws-dot rws-dot-off" }), h("span", null, value.configured ? "已就绪" : `还缺：${value.missing.join("、")}`)));
				const described = hostFace.value;
				kids.push(h("p", {
					key: "face",
					className: "rws-dim",
					"data-rws-host-face": hostFace.status,
					"data-rws-describe": hostFace.status === "ready" ? "ok" : hostFace.status === "error" ? "error" : "idle",
					"data-rws-remote-endpoints": String(described === null ? 0 : described.endpoints.length),
					"data-rws-remote-namespace": described === null ? "" : described.namespace,
					"data-rws-remote-revision": described === null ? "" : described.revision
				}, described === null ? "宿主能力：读取中…" : `宿主能力：${described.namespace} · ${described.endpoints.length} 个方法 · revision ${described.revision.slice(0, 12)}`));
				if (value.migrated) kids.push(h("p", {
					key: "mig",
					className: "rws-dim"
				}, "检测到旧版配置，已自动转换为下面的主机条目，请确认后保存。"));
				if (value.hint !== "") kids.push(h("p", {
					key: "hint",
					className: "rws-dim"
				}, value.hint));
				if (draft.length === 0) kids.push(h("p", {
					key: "empty",
					className: "rws-dim"
				}, "还没有主机。点「添加主机」，或从下面的候选里导入。"));
				draft.forEach((host, index) => {
					kids.push(h("div", {
						key: `h${String(index)}`,
						className: "rws-card",
						"data-rws-host-card": host.id
					}, h("div", { className: "rws-card-head" }, h("span", { className: "rws-card-title" }, host.name === "" ? host.address === "" ? host.fromAlias === "" ? "新主机" : host.fromAlias : host.address : host.name), host.fromAlias === "" ? null : h("span", { className: "rws-tag" }, `ssh 别名 ${host.fromAlias}`)), h("div", { className: "rws-grid" }, ...HOST_FIELDS.map((spec) => field(index, spec)), host.auth === "key" ? field(index, {
						key: "keyPath",
						label: "私钥路径",
						placeholder: "~/.ssh/id_ed25519"
					}) : null, host.auth === "password" ? field(index, {
						key: "passwordRef",
						label: "密码引用名",
						placeholder: "例如 MY_REMOTE_PASSWORD"
					}) : null), h("div", { className: "rws-card-act" }, h("button", {
						type: "button",
						className: "rws-btn rws-btn-primary",
						"data-rws-open": host.id,
						title: "建立 SSH 隧道并打开这台机器上的 DSH",
						onClick: () => {
							openRemote(host);
						}
					}, "打开远端项目"), h("button", {
						type: "button",
						className: "rws-btn",
						onClick: () => setDraft((current) => current.filter((_, i) => i !== index))
					}, "移除"))));
				});
				const candidates = value.candidates;
				if (candidates.length > 0) {
					const imported = new Set(draft.map((host) => host.fromAlias === "" ? host.id : host.fromAlias));
					const rest = candidates.filter((candidate) => !imported.has(candidate.id));
					if (rest.length > 0) kids.push(h("div", {
						key: "imp",
						className: "rws-import"
					}, h("p", { className: "rws-dim" }, `从 ~/.ssh/config 导入（已有 ${String(candidates.length)} 条候选）：`), h("div", { className: "rws-chips" }, ...rest.map((candidate) => h("button", {
						key: candidate.id,
						type: "button",
						className: "rws-chip",
						title: candidate.detail,
						onClick: () => importAlias(candidate)
					}, `+ ${candidate.id}`)))));
				}
				kids.push(h("div", {
					key: "scalars",
					className: "rws-grid"
				}, h("label", { className: "rws-fld" }, h("span", { className: "rws-fld-label" }, "批次目录 M（审查回路，可选）"), h("input", {
					className: "rws-fld-input",
					value: scalars.mDir,
					placeholder: "/home/me/.rd/m",
					"data-testid": "rws.settings.field.mDir",
					onChange: (event) => setScalars({
						...scalars,
						mDir: event.target.value
					})
				})), h("label", { className: "rws-fld" }, h("span", { className: "rws-fld-label" }, "hub（审查回路，可选）"), h("input", {
					className: "rws-fld-input",
					value: scalars.hub,
					placeholder: "/home/me/hub",
					"data-testid": "rws.settings.field.hub",
					onChange: (event) => setScalars({
						...scalars,
						hub: event.target.value
					})
				})), h("label", { className: "rws-fld" }, h("span", { className: "rws-fld-label" }, "rd-core 引擎路径（可选）"), h("input", {
					className: "rws-fld-input",
					value: scalars.enginePath,
					placeholder: "留空则使用包内引擎",
					"data-testid": "rws.settings.field.enginePath",
					onChange: (event) => setScalars({
						...scalars,
						enginePath: event.target.value
					})
				}))));
				kids.push(h("div", {
					key: "act",
					className: "rws-actions"
				}, h("button", {
					type: "button",
					className: "rws-btn",
					"data-testid": "rws.settings.addHost",
					onClick: addHost
				}, "添加主机"), h("button", {
					type: "button",
					className: "rws-btn rws-btn-primary",
					disabled: busy,
					onClick: () => {
						save();
					}
				}, busy ? "保存中…" : "保存"), h("button", {
					type: "button",
					className: "rws-btn",
					onClick: () => props.loadConfig()
				}, "重新读取"), h("span", {
					className: "rws-dim",
					"data-rws-settings-message": "1"
				}, message)));
				const rows = tunnels.tunnels;
				kids.push(h("div", {
					key: "tunnels",
					className: "rws-import",
					"data-rws-tunnels": String(rows.length)
				}, h("p", { className: "rws-dim" }, `活动隧道（${String(rows.length)}）：`), rows.length === 0 ? h("p", { className: "rws-dim" }, "没有活动隧道。") : h("div", { className: "rws-chips" }, ...rows.map((tunnel) => h("span", {
					key: tunnel.hostId,
					className: "rws-chip",
					"data-rws-tunnel": tunnel.hostId,
					"data-rws-tunnel-alive": tunnel.alive ? "1" : "0"
				}, `${tunnel.hostId} → 127.0.0.1:${String(tunnel.localPort)}`, h("button", {
					type: "button",
					className: "rws-btn",
					onClick: () => {
						closeTunnel(tunnel.hostId);
					}
				}, "关闭"))))));
				if (tunnels.status === "error" && tunnels.failure !== null) kids.push(h("p", {
					key: "terr",
					className: "rws-err"
				}, `隧道清单读取失败：${props.failureText(tunnels.failure)}`));
				if (hosts.status === "error" && hosts.failure !== null) kids.push(h("p", {
					key: "herr",
					className: "rws-err"
				}, `主机清单读取失败：${props.failureText(hosts.failure)}`));
			}
			return h("section", {
				className: "rws-sec",
				"data-rws-section": "remote-dev",
				"data-rws-config": config.status
			}, kids);
		}
		/**
		* Workspace directory flow: pick a host, then browse that host's filesystem.
		*
		* Registered at `priority: -1` into both `directoryFlow` single holes, which is
		* that hole's documented shadowing rule ("lowest renders"); the built-in picker
		* stays at 0. Remote commits register the project on the host and open that
		* machine's DSH; the host-issued `location` token rides every write verb
		* verbatim, and a `location-mismatch` is recovered by re-listing once.
		* @param props - flow face + owner props.
		* @returns dialog element (or null while closed).
		*/
		function DirectoryFlow(props) {
			const hosts = props.useHosts();
			const [hostId, setHostId] = react.useState("local");
			const [showAll, setShowAll] = react.useState(false);
			const [listing, setListing] = react.useState(null);
			const [loading, setLoading] = react.useState(false);
			const [error, setError] = react.useState("");
			const [showHidden, setShowHidden] = react.useState(false);
			const [newName, setNewName] = react.useState(null);
			const [busyCommit, setBusyCommit] = react.useState(false);
			const [opened, setOpened] = react.useState(null);
			const [notice, setNotice] = react.useState("");
			const currentHost = react.useRef(hostId);
			const host = hosts.targets.find((item) => item.id === hostId) ?? LOCAL_VIEW;
			const isRemote = host.kind !== "local";
			const selectable = props.useSelectable(showAll);
			const load = react.useCallback(async (targetHost, path) => {
				setLoading(true);
				setError("");
				const outcome = await props.listDirectory(targetHost, path);
				if (currentHost.current !== targetHost) return null;
				setLoading(false);
				if (!outcome.ok) {
					setListing(null);
					setError(props.failureText(outcome.failure));
					return null;
				}
				setListing(outcome.value);
				return outcome.value;
			}, []);
			react.useEffect(() => {
				if (!props.open) return;
				setNewName(null);
				setNotice("");
				setOpened(null);
				currentHost.current = hostId;
				setListing(null);
				load(hostId, "");
			}, [props.open, hostId]);
			if (!props.open) return null;
			const visible = (listing === null ? [] : listing.entries).filter((entry) => showHidden || !entry.hidden);
			const commit = async () => {
				if (listing === null) return;
				if (listing.target.hostId !== hostId) {
					setError(`目录清单属于 ${listing.target.hostId}，与当前主机 ${hostId} 不一致：已阻止提交。`);
					return;
				}
				if (!isRemote) {
					props.onPicked(listing.path);
					return;
				}
				setBusyCommit(true);
				setError("");
				const outcome = await props.openProject(listing.location, true, true);
				setBusyCommit(false);
				if (!outcome.ok) {
					if (outcome.failure.code === "remote-dev/location-mismatch") {
						setNotice("目录身份凭证已刷新华，正在重新读取目录…");
						const refreshed = await load(hostId, listing.path);
						setNotice(refreshed === null ? "" : "凭证已刷新，请再次提交。");
						return;
					}
					setError(props.failureText(outcome.failure));
					props.onError(props.failureText(outcome.failure));
					return;
				}
				setOpened(outcome.value);
				try {
					window.open(outcome.value.url, "_blank", "noopener");
				} catch {}
			};
			const createFolder = async () => {
				if (listing === null) return;
				const name = (newName ?? "").trim() === "" ? "未命名文件夹" : (newName ?? "").trim();
				const outcome = await props.createDirectory(listing.location, name);
				if (!outcome.ok) {
					if (outcome.failure.code === "remote-dev/location-mismatch") {
						setNotice("目录身份凭证已失效，正在重新读取目录…");
						await load(hostId, listing.path);
						return;
					}
					setError(props.failureText(outcome.failure));
					return;
				}
				setNewName(null);
				await load(hostId, listing.path);
			};
			const openSystemChooser = async () => {
				const picked = await props.pickDirectory();
				if (picked !== null && picked !== "") props.onPicked(picked);
			};
			const crumbs = [h("button", {
				key: "host",
				type: "button",
				className: "rws_crumb rws_crumbHost",
				"data-rws-crumb-host": host.id,
				title: host.detail,
				onClick: () => {
					load(hostId, "");
				}
			}, host.name)];
			if (listing !== null) {
				let accumulated = "";
				listing.path.split("/").filter(Boolean).forEach((segment, index) => {
					accumulated += `/${segment}`;
					const target = accumulated;
					crumbs.push(h("span", {
						key: `sep${String(index)}`,
						className: "rws_crumbSep"
					}, "/"));
					crumbs.push(h("button", {
						key: `seg${String(index)}`,
						type: "button",
						className: "rws_crumb",
						onClick: () => {
							load(hostId, target);
						}
					}, segment));
				});
			}
			const extras = [];
			if (newName !== null) extras.push(h("div", {
				className: "rws_row",
				key: "new"
			}, h("span", { className: "rws_lbl" }, "新建"), h("input", {
				className: "rws_input",
				value: newName,
				placeholder: "文件夹名称",
				"data-testid": "rws.flow.newFolderName",
				onChange: (event) => setNewName(event.target.value)
			}), h("button", {
				type: "button",
				className: "rws_btn rws_btnPrimary",
				onClick: () => {
					createFolder();
				}
			}, "创建"), h("button", {
				type: "button",
				className: "rws_btn",
				onClick: () => setNewName(null)
			}, "取消")));
			if (notice !== "") extras.push(h("div", {
				className: "rws_note",
				key: "notice"
			}, notice));
			if (error !== "") extras.push(h("div", {
				className: "rws_err",
				key: "err",
				"data-rws-error": "1"
			}, error));
			return h("div", {
				className: "rws_mask",
				"data-rws-flow": "1"
			}, h("div", { className: "rws_dlg" }, h("div", { className: "rws_dlgHead" }, h("span", null, "选择工作区目录"), h("button", {
				type: "button",
				className: "rws_btn",
				onClick: props.onCancel
			}, "关闭")), h("div", { className: "rws_dlgBody" }, h("div", { className: "rws_row" }, h("span", { className: "rws_lbl" }, "主机"), ...selectable.map((item) => h("button", {
				key: item.id,
				type: "button",
				className: "rws_chip",
				"data-selected": String(item.id === hostId),
				"data-host": item.id,
				title: item.detail,
				onClick: () => setHostId(item.id)
			}, Dot(item.state), h("span", null, item.name), item.detail === "" ? null : h("span", { className: "rws_chipDetail" }, item.detail))), props.useExtraCount() > 0 ? h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-showall": "1",
				title: "显示 ~/.ssh/config 里的其它机器（未在设置中添加）",
				onClick: () => setShowAll(!showAll)
			}, showAll ? "只看已配置" : `更多主机（${String(props.useExtraCount())}）`) : null, hosts.failure === null ? null : h("span", { className: "rws_err" }, `清单读取失败：${props.failureText(hosts.failure)}`)), h("div", {
				className: "rws_crumbs",
				"data-rws-crumbs": "1"
			}, ...crumbs), h("div", { className: "rws_row" }, h("button", {
				type: "button",
				className: "rws_btn",
				disabled: listing === null || listing.parent === void 0,
				onClick: () => {
					if (listing !== null && listing.parent !== void 0) load(hostId, listing.parent);
				}
			}, "上级"), h("button", {
				type: "button",
				className: "rws_btn",
				disabled: listing === null,
				onClick: () => {
					if (listing !== null) load(hostId, listing.home);
				}
			}, "主目录"), h("button", {
				type: "button",
				className: "rws_btn",
				disabled: listing === null,
				onClick: () => setNewName("")
			}, "新建文件夹"), h("span", { className: "rws_grow" }), isRemote ? h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-reprobe": "1",
				onClick: () => props.loadTargets({
					probe: true,
					fresh: true
				})
			}, "重新探测") : h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-os-chooser": "1",
				onClick: () => {
					openSystemChooser();
				}
			}, "打开系统选择器"), h("label", {
				className: "rws_row",
				style: {
					gap: "4px",
					cursor: "pointer"
				}
			}, h("input", {
				type: "checkbox",
				checked: showHidden,
				onChange: (event) => setShowHidden(event.target.checked)
			}), h("span", { className: "rws_lbl" }, "显示隐藏"))), h("div", {
				className: "rws_list",
				"data-rws-list": host.id,
				"data-testid": "rws.flow.list"
			}, loading ? h("div", { className: "rws_empty" }, "加载中…") : visible.length === 0 ? h("div", { className: "rws_empty" }, listing === null ? "无法列出" : "没有子目录") : visible.map((entry) => h("button", {
				key: entry.path,
				type: "button",
				className: `rws_item${entry.hidden ? " rws_itemHidden" : ""}`,
				onClick: () => {
					load(hostId, entry.path);
				}
			}, h("span", null, "📁"), h("span", { className: "rws_itemName" }, entry.name)))), ...extras), h("div", { className: "rws_dlgFoot" }, opened === null ? h("span", {
				className: "rws_note",
				"data-rws-remote-note": "1"
			}, isRemote ? `将把 ${listing === null ? "" : listing.path} 登记为 ${host.name} 上的远端项目，并打开那台机器上的 DSH。` : h("span", { className: "rws_lbl" }, listing === null ? "" : listing.path)) : h("span", {
				className: "rws_note",
				"data-rws-remote-note": "1"
			}, `已在 ${opened.host} 上打开：${opened.path} `, h("a", {
				"data-testid": "rws.flow.openLink",
				href: opened.url,
				target: "_blank",
				rel: "noopener",
				style: {
					marginLeft: "6px",
					color: "inherit"
				}
			}, opened.url), opened.warning === void 0 ? null : `　⚠️ ${opened.warning}`), h("span", { className: "rws_grow" }), h("button", {
				type: "button",
				className: "rws_btn",
				onClick: props.onCancel
			}, "取消"), h("button", {
				type: "button",
				className: "rws_btn rws_btnPrimary",
				disabled: props.busy || busyCommit || listing === null || listing.target.hostId !== hostId,
				"data-rws-commit": "1",
				"data-testid": "rws.flow.commit",
				onClick: () => {
					commit();
				}
			}, busyCommit ? "连接中…" : props.busy ? "创建中…" : isRemote ? "创建远端项目" : "选择此目录"))));
		}
		const STEP_LABEL = {
			apply: "应用到 W",
			verify: "本地验证",
			"push-base": "推进基线",
			"m-sync": "回灌 M"
		};
		/** Split one batch diff into per-file chunks on `diff --git` boundaries. */
		function splitDiff(diff) {
			const chunks = {};
			let current = null;
			for (const line of diff.split("\n")) {
				if (line.startsWith("diff --git ")) {
					const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
					current = match === null ? "" : match[2] ?? "";
					chunks[current] = [];
					continue;
				}
				if (current !== null) chunks[current]?.push(line);
			}
			const out = {};
			for (const key of Object.keys(chunks)) out[key] = (chunks[key] ?? []).join("\n").replace(/\n+$/, "");
			return out;
		}
		/** Line-coloured diff body. */
		function DiffView(text) {
			if (text === "") return h("pre", { className: "rws_diff" }, "（无 diff）");
			return h("pre", {
				className: "rws_diff",
				"data-rws-diff": "1"
			}, ...text.split("\n").map((line, index) => {
				let className = "";
				if (/^(\+\+\+|---|@@|diff |index |new file|deleted file)/.test(line)) className = "rws_diffMeta";
				else if (line.startsWith("+")) className = "rws_diffAdd";
				else if (line.startsWith("-")) className = "rws_diffDel";
				return h("div", {
					key: index,
					className
				}, line === "" ? " " : line);
			}));
		}
		/**
		* Batch review overlay.
		*
		* There is deliberately **no** fetch on mount: a mount-time read whose async
		* arrival writes state would drive a render loop inside this very slot, and a
		* batch read is an ssh + engine round trip. The launcher only renders; the user's
		* click opens the panel and is what triggers the read.
		* @param props - review face.
		* @returns launcher, or the open panel.
		*/
		function ReviewPanel(props) {
			const review = props.useReview();
			const diagnostics = props.useDiagnostics();
			const [open, setOpen] = react.useState(false);
			const [verdicts, setVerdicts] = react.useState({});
			const [comment, setComment] = react.useState("");
			const [active, setActive] = react.useState("");
			const [verify, setVerify] = react.useState(true);
			const readySlots = Object.keys(diagnostics.slots).filter((name) => diagnostics.slots[name] === true);
			const diagnosticsNode = h("span", {
				className: "rws-diag",
				"data-rws-diagnostics": "1",
				"data-rws-describe": diagnostics.describe,
				"data-rws-targets": diagnostics.targets,
				"data-rws-config": diagnostics.config,
				"data-rws-endpoints": String(diagnostics.endpoints),
				"data-rws-targets-count": String(diagnostics.targetsCount),
				"data-rws-slots-total": String(Object.keys(diagnostics.slots).length),
				"data-rws-slots-ready": readySlots.join(","),
				"data-rws-slot-header": diagnostics.slots["conversation.session.header.actions"] === true ? "1" : "0",
				"data-rws-slot-settings": diagnostics.slots["settings.section"] === true ? "1" : "0",
				"data-rws-slot-hero": diagnostics.slots["conversation.hero.workspace.directoryFlow"] === true ? "1" : "0",
				"data-rws-slot-sidebar": diagnostics.slots["sidebar.workspaces.directoryFlow"] === true ? "1" : "0",
				"data-rws-slot-overlay": diagnostics.slots["shell.overlay"] === true ? "1" : "0"
			});
			const batch = review.batch;
			const pending = batch === null ? 0 : batch.files.length;
			const launcher = h("button", {
				type: "button",
				className: `rws_launcher${pending > 0 ? " rws_launcherPending" : ""}`,
				"data-rws-launcher": "1",
				"data-rws-pending": String(pending),
				"data-testid": "rws.review.launcher",
				onClick: () => {
					setOpen(true);
					props.reviewBatch();
				}
			}, Dot(batch === null ? "unknown" : pending > 0 ? "reconnecting" : "connected"), "远端审阅", batch === null ? "" : pending > 0 ? ` · ${String(pending)} 个文件待审` : " · 无待审批次");
			if (!open) return h("span", null, launcher, diagnosticsNode);
			const chunks = batch === null ? {} : splitDiff(batch.diff);
			const approved = Object.keys(verdicts).filter((path) => verdicts[path] === "approve");
			const rejected = Object.keys(verdicts).filter((path) => verdicts[path] === "reject");
			const applyResult = review.applyResult;
			const statusRows = applyResult === null ? [] : applyResult.steps.map((step) => h("div", {
				className: "rws_statusRow",
				key: step.step
			}, h("span", { className: step.code === 0 ? "rws_ok" : "rws_bad" }, step.code === 0 ? "✓" : "✗"), h("span", null, STEP_LABEL[step.step] ?? step.step), h("span", { className: "rws_sha" }, `exit ${String(step.code)}`)));
			return h("span", null, diagnosticsNode, h("div", {
				className: "rws_mask",
				"data-rws-review": "1"
			}, h("div", { className: "rws_dlg" }, h("div", { className: "rws_dlgHead" }, h("span", null, "批次审阅"), h("button", {
				type: "button",
				className: "rws_btn",
				onClick: () => setOpen(false)
			}, "关闭")), h("div", { className: "rws_dlgBody" }, review.failure === null ? null : h("div", {
				className: "rws_err",
				"data-rws-error": review.failure.code
			}, `取批失败：${props.failureText(review.failure)}`), review.status === "loading" && batch === null ? h("div", {
				className: "rws_card",
				"data-rws-loading": "1"
			}, h("div", { className: "rws_cardTop" }, Dot("connecting"), h("span", null, "正在读取批次…"))) : null, batch === null ? null : h("div", {
				className: "rws_card",
				"data-rws-card": "1"
			}, h("div", { className: "rws_cardTop" }, h("span", { className: "rws_tag rws_tagM" }, "批次"), h("span", { className: "rws_sha" }, `${batch.base.slice(0, 8)} → ${batch.head.slice(0, 8)}`), h("span", { className: "rws_lbl" }, `${String(batch.files.length)} 个文件`)), h("div", { className: "rws_cardTop" }, h("span", { className: "rws_lbl" }, "主机"), h("span", { "data-rws-review-host": batch.target.hostId }, batch.target.hostId), h("span", { className: "rws_lbl" }, "引擎"), h("span", { className: "rws_sha" }, batch.engine))), batch === null ? null : h("div", {
				className: "rws_lbl",
				"data-rws-empty": batch.empty ? "1" : "0"
			}, batch.empty ? "没有待审批次（基线已与镜像一致）。" : ""), ...batch === null ? [] : batch.files.map((file) => h("div", {
				key: file.path,
				className: "rws_frow",
				"data-rws-file": file.path,
				"data-testid": "rws.review.file",
				"data-active": String(active === file.path)
			}, h("span", { className: `rws_tag rws_tag${file.status}` }, file.status), h("button", {
				type: "button",
				className: "rws_fpath",
				onClick: () => setActive(file.path)
			}, file.path), h("span", { className: "rws_num rws_add" }, `+${String(file.add ?? "bin")}`), h("span", { className: "rws_num rws_del" }, `-${String(file.del ?? "bin")}`), h("button", {
				type: "button",
				className: `rws_verdict ${verdicts[file.path] === "reject" ? "rws_verdictReject" : "rws_verdictApprove"}`,
				"data-rws-verdict": verdicts[file.path] ?? "approve",
				onClick: () => setVerdicts({
					...verdicts,
					[file.path]: verdicts[file.path] === "reject" ? "approve" : "reject"
				})
			}, verdicts[file.path] === "reject" ? "拒绝" : "批准"))), active !== "" && chunks[active] !== void 0 ? DiffView(chunks[active] ?? "") : null, h("textarea", {
				className: "rws_area",
				placeholder: "拒因 / 修改请求（拒绝时必填，会 append-only 留痕）",
				value: comment,
				onChange: (event) => setComment(event.target.value)
			}), h("div", {
				className: "rws_status",
				"data-rws-status": "1"
			}, h("div", { className: "rws_statusRow" }, h("span", { className: "rws_lbl" }, "状态"), h("span", null, review.busy ? "处理中…" : review.note)), h("div", { className: "rws_statusRow" }, h("label", {
				className: "rws_row",
				style: {
					gap: "4px",
					cursor: "pointer"
				}
			}, h("input", {
				type: "checkbox",
				checked: verify,
				onChange: (event) => setVerify(event.target.checked)
			}), h("span", { className: "rws_lbl" }, "应用后本地验证"))), ...statusRows)), h("div", { className: "rws_dlgFoot" }, h("button", {
				type: "button",
				className: "rws_btn",
				disabled: review.busy,
				onClick: () => {
					props.reviewBatch();
				}
			}, "刷新"), h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-status-refresh": "1",
				disabled: review.busy,
				onClick: () => {
					props.reviewStatus();
				}
			}, "检查状态"), h("span", { className: "rws_grow" }), h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-rollback": "1",
				disabled: review.busy || batch === null,
				onClick: () => {
					if (batch !== null) props.reviewRollback(batch.base);
				}
			}, "回滚到基线"), h("button", {
				type: "button",
				className: "rws_btn",
				"data-rws-reject": "1",
				disabled: review.busy || rejected.length === 0 || comment.trim() === "",
				onClick: () => {
					props.reviewReject(rejected, comment.trim());
				}
			}, "拒绝并留痕"), h("button", {
				type: "button",
				className: "rws_btn rws_btnPrimary",
				"data-rws-apply": "1",
				disabled: review.busy || approved.length === 0,
				onClick: () => {
					props.reviewApply(approved, verify);
				}
			}, review.busy ? "处理中…" : "批准并应用")))));
		}
		//#endregion
		//#region packages/perse-remote-dev/src/client/messages.ts
		/** Read one string field out of an untyped `details` bag. */
		function detailString(details, key) {
			if (typeof details !== "object" || details === null) return "";
			const value = details[key];
			return typeof value === "string" ? value : "";
		}
		/** Read one string-array field out of an untyped `details` bag. */
		function detailList(details, key) {
			if (typeof details !== "object" || details === null) return [];
			const value = details[key];
			return Array.isArray(value) ? value.map((item) => String(item)) : [];
		}
		/**
		* Human copy for one Remote failure.
		* @param failure - flattened Remote failure.
		* @returns product-visible message.
		*/
		function failureText(failure) {
			const { code, message, details } = failure;
			switch (code) {
				case "remote-dev/target-unknown": return `未知主机 ${detailString(details, "hostId") || "（未提供）"}：请先在「设置 › 远程开发」添加，或检查 ~/.ssh/config 别名。`;
				case "remote-dev/target-not-remote": return `该操作需要 ssh 主机，但收到的是本机（${detailString(details, "hostId") || "local"}）。`;
				case "remote-dev/ssh-unreachable": return `ssh 无法连接到 ${detailString(details, "hostId")}：${detailString(details, "stderr") || message}`;
				case "remote-dev/remote-dsh-down": return `已连上 ${detailString(details, "hostId")}，但远端 DSH（端口 ${detailString(details, "port")}）没有在监听。`;
				case "remote-dev/tunnel-failed": return `隧道建立失败（${detailString(details, "hostId")}）：${detailString(details, "stderr") || message}`;
				case "remote-dev/tunnel-port-exhausted": return `本地端口已用尽（${detailString(details, "from")}–${detailString(details, "to")}）。`;
				case "remote-dev/tunnel-not-found": return `${detailString(details, "hostId")} 上没有活动隧道。`;
				case "remote-dev/token-unavailable": {
					const url = detailString(details, "url");
					return `未取得远端访问令牌：${detailString(details, "reason") || message}${url === "" ? "" : `　降级地址：${url}`}`;
				}
				case "remote-dev/location-invalid": return `路径不合法：${detailString(details, "path")}`;
				case "remote-dev/location-mismatch": return `目录身份凭证已失效（主机 ${detailString(details, "hostId")} / ${detailString(details, "path")}）：已重新读取目录，请再试一次。`;
				case "remote-dev/name-invalid": return `目录名不合法：${detailString(details, "name")}`;
				case "remote-dev/directory-exists": return `目录已存在：${detailString(details, "path")}`;
				case "remote-dev/directory-unreadable": return `目录不可访问：${detailString(details, "path")}（${detailString(details, "reason") || message}）`;
				case "remote-dev/list-failed": return `列举目录失败（${detailString(details, "hostId")}，exit ${detailString(details, "code")}）：${detailString(details, "stderr")}`;
				case "remote-dev/mkdir-failed": return `创建目录失败：${detailString(details, "path")}（${detailString(details, "reason") || message}）`;
				case "remote-dev/settings-unavailable": return "宿主 settings 服务不可用，配置面无法读写。";
				case "remote-dev/config-invalid": return `配置校验未通过：${detailList(details, "problems").join("；") || message}`;
				case "remote-dev/review-target-missing": return `审查回路未就绪，缺少：${detailList(details, "missing").join("、")}`;
				case "remote-dev/engine-unconfigured": return "未配置 rd-core 引擎路径（enginePath）。";
				case "remote-dev/engine-failed": return `引擎步骤 ${detailString(details, "step")} 失败（exit ${detailString(details, "code")}）：${detailString(details, "output").slice(0, 200)}`;
				case "remote-dev/base-missing": return `汇总仓库 ${detailString(details, "hub")} 上没有 rd-base。`;
				case "remote-dev/files-empty": return "未选择任何文件。";
				case "remote-dev/files-unchanged": return `所选文件在当前批次里没有改动：${detailList(details, "files").join("、")}`;
				case "remote-dev/patch-empty": return "裁剪后补丁为空。";
				case "remote-dev/comment-empty": return "拒绝需要填写拒因。";
				case "remote-dev/ref-missing": return "回滚缺少 ref。";
				case "gateway/bad-request": return `请求未通过宿主校验：${message}`;
				case "gateway/cancelled": return "调用已取消。";
				case "gateway/internal": return `宿主内部错误：${message}`;
				default: return `${code}: ${message}`;
			}
		}
		//#endregion
		//#region packages/perse-remote-dev/src/client/styles.ts
		/**
		* Style injection for the browser half.
		*
		* The official preset would compile CSS Modules with lightningcss; this
		* out-of-tree bundle cannot reach that preset, so the client lane ships one plain
		* stylesheet as a tagged `<style>` element, following the dynamic-package
		* guidance: build markup with `React.createElement` and ship CSS through
		* `styles.insert`.
		*
		* Every colour comes from a real DSH semantic token (`--dsw-alias-*`). Tokens
		* such as `--dsw-border`/`--dsw-accent` do not exist, so inputs must not use
		* them (they would render borderless).
		*/
		/** `id` of the single injected stylesheet element. */
		const STYLE_ID = "perse-remote-dev-style";
		const CSS = [
			".rws_badge{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 6px;border-radius:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);cursor:default;user-select:none}",
			".rws_badge:hover{color:var(--dsw-alias-label-secondary)}",
			".rws_dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}",
			".rws_dot[data-state=connected]{background:var(--dsw-alias-state-success-primary,rgb(46,160,67))}",
			".rws_dot[data-state=connecting],.rws_dot[data-state=reconnecting]{background:var(--dsw-alias-state-warn-primary,rgb(210,153,34))}",
			".rws_dot[data-state=disconnected]{background:var(--dsw-alias-state-error-primary,rgb(248,81,73))}",
			".rws_host{color:var(--dsw-alias-label-secondary)}",
			".rws_sep{opacity:.45}",
			".rws_mask{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center}",
			".rws_dlg{width:min(760px,92vw);max-height:82vh;display:flex;flex-direction:column;border-radius:12px;background:var(--dsw-alias-bg-layer-1,#1e1e1e);color:var(--dsw-alias-label-primary,#eee);box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden}",
			".rws_dlgHead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));font-size:13px;font-weight:600}",
			".rws_dlgBody{padding:10px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px}",
			".rws_dlgFoot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22))}",
			".rws_row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".rws_lbl{font-size:12px;color:var(--dsw-alias-label-tertiary);min-width:32px}",
			".rws_chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:12px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}",
			".rws_chip:hover{border-color:var(--dsw-alias-label-tertiary)}",
			".rws_chip[data-selected=true]{color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-label-secondary);background:rgba(127,127,127,.16)}",
			".rws_chipDetail{opacity:.6;font-size:11px}",
			".rws_crumbs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:12px;min-height:22px}",
			".rws_crumb{background:none;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:2px 4px;border-radius:4px;font-size:12px}",
			".rws_crumb:hover{background:rgba(127,127,127,.16)}",
			".rws_crumbHost{color:var(--dsw-alias-label-primary,#fff);font-weight:600}",
			".rws_crumbSep{opacity:.45}",
			".rws_list{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));border-radius:8px;max-height:38vh;overflow:auto}",
			".rws_item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:6px 10px;font-size:12px;line-height:18px;cursor:pointer}",
			".rws_item:hover{background:rgba(127,127,127,.14)}",
			".rws_itemName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".rws_itemHidden{opacity:.55}",
			".rws_empty{padding:14px;font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".rws_btn{padding:5px 11px;border-radius:6px;font-size:12px;line-height:18px;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}",
			".rws_btn:hover{border-color:var(--dsw-alias-label-tertiary)}",
			".rws_btn[disabled]{opacity:.4;cursor:not-allowed}",
			".rws_btnPrimary{background:var(--dsw-alias-brand-primary,#2f6feb);border-color:var(--dsw-alias-brand-primary,#2f6feb);color:#fff}",
			".rws_grow{flex:1}",
			".rws_note{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary,#d29922)}",
			".rws_err{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#f85149)}",
			".rws_input{padding:4px 8px;border-radius:6px;font-size:12px;background:rgba(127,127,127,.14);color:inherit;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}",
			".rws_launcher{position:fixed;right:14px;bottom:14px;z-index:8800;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-secondary,#ddd);background:var(--dsw-alias-bg-layer-1,#242424);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.32));box-shadow:0 4px 14px rgba(0,0,0,.28)}",
			".rws_launcher:hover{border-color:var(--dsw-alias-label-tertiary)}",
			".rws_launcherPending{border-color:var(--dsw-alias-state-warn-primary,#d29922)}",
			".rws_card{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;background:rgba(127,127,127,.1);font-size:12px;line-height:18px}",
			".rws_cardTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".rws_sha{font-family:ui-monospace,Menlo,monospace;font-size:11px;opacity:.85}",
			".rws_tag{display:inline-block;min-width:16px;text-align:center;border-radius:4px;padding:0 4px;font-size:11px;font-weight:700}",
			".rws_tagA{background:rgba(46,160,67,.22);color:rgb(63,185,80)}",
			".rws_tagM{background:rgba(210,153,34,.22);color:rgb(210,153,34)}",
			".rws_tagD{background:rgba(248,81,73,.22);color:rgb(248,81,73)}",
			".rws_frow{display:flex;align-items:center;gap:8px;width:100%;background:none;border:0;color:inherit;padding:5px 8px;font-size:12px;border-radius:6px}",
			".rws_frow[data-active=true]{background:rgba(47,111,235,.16)}",
			".rws_fpath{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,monospace;background:none;border:0;color:inherit;cursor:pointer}",
			".rws_num{font-family:ui-monospace,Menlo,monospace;font-size:11px}",
			".rws_add{color:rgb(63,185,80)}",
			".rws_del{color:rgb(248,81,73)}",
			".rws_verdict{font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid transparent;cursor:pointer;background:transparent;color:inherit}",
			".rws_verdictApprove{border-color:rgba(46,160,67,.6);color:rgb(63,185,80)}",
			".rws_verdictReject{border-color:rgba(248,81,73,.6);color:rgb(248,81,73)}",
			".rws_diff{margin:0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.28);font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:16px;max-height:26vh;overflow:auto;white-space:pre}",
			".rws_diffAdd{color:rgb(63,185,80)}",
			".rws_diffDel{color:rgb(248,81,73)}",
			".rws_diffMeta{opacity:.6}",
			".rws_status{display:flex;flex-direction:column;gap:3px;font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;background:rgba(127,127,127,.1)}",
			".rws_statusRow{display:flex;align-items:center;gap:6px}",
			".rws_ok{color:rgb(63,185,80)}",
			".rws_bad{color:rgb(248,81,73)}",
			".rws_area{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;padding:6px 8px;border-radius:8px;font-size:12px;line-height:18px;background:rgba(127,127,127,.14);color:inherit;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}",
			".rws_sec{display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.6}",
			".rws-lead{margin:0;color:var(--dsw-alias-label-secondary)}",
			".rws-dim{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px}",
			".rws-err{margin:0;color:var(--dsw-alias-state-error-primary)}",
			".rws-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary)}",
			".rws-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-label-tertiary)}",
			".rws-dot-on{background:var(--dsw-alias-state-success-primary)}",
			".rws-dot-off{background:var(--dsw-alias-state-warn-primary)}",
			".rws-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:14px;display:flex;flex-direction:column;gap:12px}",
			".rws-card-head{display:flex;align-items:center;gap:8px}",
			".rws-card-title{font-weight:600;color:var(--dsw-alias-label-primary)}",
			".rws-tag{font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}",
			".rws-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}",
			".rws-fld{display:flex;flex-direction:column;gap:5px;min-width:0}",
			".rws-fld-label{font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".rws-fld-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 9px;color:var(--dsw-alias-label-primary);font:inherit;outline:none}",
			".rws-fld-input:focus{border-color:var(--dsw-alias-brand-primary)}",
			".rws-card-act{display:flex;justify-content:flex-end;gap:8px}",
			".rws-btn{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 12px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}",
			".rws-btn:hover{background:var(--dsw-alias-bg-layer-2)}",
			".rws-btn-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}",
			".rws-btn[disabled]{opacity:.5;cursor:default}",
			".rws-import{display:flex;flex-direction:column;gap:8px}",
			".rws-chips{display:flex;flex-wrap:wrap;gap:6px}",
			".rws-chip{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit}",
			".rws-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".rws-diag{display:inline-block;width:0;height:0;overflow:hidden}"
		].join("");
		/**
		* Inject the stylesheet once per document.
		*/
		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("perse-remote-dev-style") !== null) return;
			const element = document.createElement("style");
			element.id = STYLE_ID;
			element.textContent = CSS;
			document.head.appendChild(element);
		}
		//#endregion
		//#region packages/perse-remote-dev/src/client/index.ts
		/** Log prefix for every line this plugin prints. */
		const LOG = "[perse-remote-dev]";
		/** Slot names — the five slots this plugin registers. */
		const SLOT_HEADER = "conversation.session.header.actions";
		const SLOT_SETTINGS_SECTION = "settings.section";
		const SLOT_FLOW_HERO = "conversation.hero.workspace.directoryFlow";
		const SLOT_FLOW_SIDEBAR = "sidebar.workspaces.directoryFlow";
		const SLOT_OVERLAY = "shell.overlay";
		/**
		* Shadow priority for the two `directoryFlow` **single** slots: that hole's
		* documented rule is "a different priority shadows; lowest renders", and the
		* built-in picker registers at 0.
		*/
		const FLOW_PRIORITY = -1;
		/** Assembly row: the protocol's public mount API, exactly as official code calls it. */
		const inject = ["remote"];
		/**
		* Mount the frozen host package's `remoteDev` contribution and install the
		* consumer UI.
		* @param ctx - Client root context carrying the typed Remote facade.
		* @returns disposer that unmounts the contribution (the nested UI plugin is
		* owned by this fiber and unwinds with it).
		*/
		async function apply(ctx) {
			const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.plugin({
				name: "remote-dev-client/ui",
				inject: [
					"slots",
					"remote",
					"remote.remoteDev"
				],
				apply: applyUi
			});
			console.log(LOG, "client half: remoteDev namespace mounted");
			return async () => {
				await dispose();
			};
		}
		/**
		* Consumer plugin body: the client model, the five slot registrations, and the
		* read hooks/actions components receive through each registration's inject face.
		* @param ctx - Client context that owns `remote.remoteDev` and `slots`.
		*/
		function applyUi(ctx) {
			ensureStyles();
			const client = new RemoteWorkspaceClient(ctx);
			client.loadHostFace();
			client.loadTargets();
			client.loadConfig();
			client.loadTunnels();
			/** `ctx.get` (not property access) so a missing ui-workspace degrades to "no system picker". */
			const pickDirectory = async () => {
				const ui = ctx.get("uiWorkspace");
				if (ui === void 0) return null;
				return await ui.pickDirectory();
			};
			const badgeFace = () => ({ useActiveHost: () => {
				useCell(client.config);
				useCell(client.hosts);
				return client.activeHost();
			} });
			const sectionFace = () => ({
				useConfig: () => useCell(client.config),
				useHostFace: () => useCell(client.hostFace),
				useHosts: () => useCell(client.hosts),
				useTunnels: () => useCell(client.tunnels),
				loadConfig: () => void client.loadConfig(),
				loadHostFace: () => void client.loadHostFace(),
				loadTargets: (options) => void client.loadTargets(options ?? {}),
				loadTunnels: () => void client.loadTunnels(),
				saveConfig: (hosts, scalars) => client.saveConfig(hosts, scalars),
				openTunnel: (hostId, requireAuthentication) => client.openTunnel(hostId, requireAuthentication),
				closeTunnel: (hostId) => client.closeTunnel(hostId),
				failureText: (failure) => failureText(failure)
			});
			const flowFace = () => ({
				useHosts: () => useCell(client.hosts),
				useSelectable: (showAll) => selectableOf(client.hosts.get(), showAll),
				useExtraCount: () => client.extraHostCount(),
				loadTargets: (options) => void client.loadTargets(options ?? {}),
				listDirectory: (hostId, path) => client.listDirectory(hostId, path),
				createDirectory: (location, name) => client.createDirectory(location, name),
				openProject: (location, remember, requireAuthentication) => client.openProject(location, remember, requireAuthentication),
				pickDirectory,
				failureText: (failure) => failureText(failure)
			});
			const reviewFace = () => ({
				useReview: () => useCell(client.review),
				useDiagnostics: () => {
					useCell(client.hostFace);
					useCell(client.hosts);
					useCell(client.config);
					useCell(client.slots);
					return client.diagnostics();
				},
				reviewBatch: () => client.reviewBatch(),
				reviewStatus: () => client.reviewStatus(),
				reviewApply: (files, verify) => client.reviewApply(files, verify),
				reviewReject: (files, comment) => client.reviewReject(files, comment),
				reviewRollback: (ref) => client.reviewRollback(ref),
				failureText: (failure) => failureText(failure)
			});
			ctx.slots.inject(SLOT_HEADER, () => {
				client.markSlot(SLOT_HEADER);
				console.log(LOG, "slot declared → host badge", SLOT_HEADER);
				return ctx.slots.register({
					name: SLOT_HEADER,
					id: "remote-dev-host",
					order: 5,
					inject: badgeFace
				}, HostBadge);
			});
			ctx.slots.inject(SLOT_SETTINGS_SECTION, () => {
				client.markSlot(SLOT_SETTINGS_SECTION);
				console.log(LOG, "slot declared → settings section", SLOT_SETTINGS_SECTION);
				return ctx.slots.register({
					name: SLOT_SETTINGS_SECTION,
					id: "remote-dev",
					order: 40,
					label: () => "远程开发",
					inject: sectionFace
				}, RemoteDevSection);
			});
			ctx.slots.inject(SLOT_FLOW_HERO, () => ctx.slots.inject(SLOT_FLOW_SIDEBAR, function* () {
				client.markSlot(SLOT_FLOW_HERO);
				client.markSlot(SLOT_FLOW_SIDEBAR);
				console.log(LOG, "slots declared → directory flow", SLOT_FLOW_HERO, "/", SLOT_FLOW_SIDEBAR);
				yield ctx.slots.register({
					name: SLOT_FLOW_HERO,
					id: "remote-dev-flow",
					priority: FLOW_PRIORITY,
					inject: flowFace
				}, DirectoryFlow);
				yield ctx.slots.register({
					name: SLOT_FLOW_SIDEBAR,
					id: "remote-dev-flow",
					priority: FLOW_PRIORITY,
					inject: flowFace
				}, DirectoryFlow);
			}));
			ctx.slots.inject(SLOT_OVERLAY, () => {
				client.markSlot(SLOT_OVERLAY);
				console.log(LOG, "slot declared → review overlay", SLOT_OVERLAY);
				return ctx.slots.register({
					name: SLOT_OVERLAY,
					id: "remote-dev-review",
					order: 500,
					inject: reviewFace
				}, ReviewPanel);
			});
			console.log(LOG, "client half ready: mount + 5 slot registrations requested");
		}
		/** Selectable hosts for the flow's host row. */
		function selectableOf(snapshot, showAll) {
			return showAll ? snapshot.targets : snapshot.targets.filter((host) => host.kind === "local" || host.configured);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
