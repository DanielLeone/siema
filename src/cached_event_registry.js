export class CachedEventRegistry {
  constructor(...initialArgs) {
    this._listeners = new Set();
    this._lastArgs = initialArgs;
  }

  listen(callback) {
    this._listeners.add(callback);
    if (this._lastArgs.length) {
      callback(...this._lastArgs);
    }
    return () => this._listeners.remove(callback);
  }

  notify(...args) {
    this._lastArgs = args;
    this._listeners.forEach(l => l(...args));
  }
}
