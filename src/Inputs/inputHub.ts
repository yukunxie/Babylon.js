import { Scene, IDisposable } from '../scene';
import { Engine } from '../Engines/engine';
import { Nullable } from '../types';
import { Observer, Observable } from '../Misc/observable';
import { KeyboardInfo, KeyboardEventTypes } from '../Events/keyboardEvents';
import { PointerInfo, PointerEventTypes } from '../Events/pointerEvents';

/**
 * List of supported devices
 */
export enum InputHubDevice {
    /** Keyboard */
    Keyboard,
    /** Mouse */
    Mouse
}

/**
 * Interface used to define a hub trigger
 */
export class IInputHubEventTrigger {
    /**
     * Define the hardware device that will emit the event
     */
    device: InputHubDevice;
    /** Does it require ALT to be pressed */
    altModifier?: boolean;
    /** Does it require SHIFT to be pressed */
    shiftModifier?: boolean;
    /** Does it require CTRL to be pressed */
    ctrlModifier?: boolean;
    /** Defines that the even will be raised on key up */
    released?: boolean;
    /** If sets to false, the modifier must be the left one. If sets to true the modifier must be the right one.
     *  If unset, both will work
     */
    rightModifier?: boolean;
}

/**
 * Interface used to represent an event from the keyboard
 */
export interface IInputHubKeyboardEventTrigger extends IInputHubEventTrigger {
    /** Key code */
    keyCode: number;
}

/**
 * Interface used to represent an event from the mouse
 */
export interface IInputHubMouseEventTrigger extends IInputHubEventTrigger {
    /** button ID: 0 for left, 1 for middle, 2 for right */
    button: number;
}


/** @hidden */
class KeyboardHubEvent {
    constructor(public name: string, public trigger: IInputHubKeyboardEventTrigger) {
    }
}

/** @hidden */
class MouseHubEvent {
    constructor(public name: string, public trigger: IInputHubMouseEventTrigger) {
    }
}

/**
 * Class used to abstract inputs by adding an event system on top of hardware
 */
export class InputHub implements IDisposable {
    private _scene: Scene;
    private _onKeyboardObserver: Nullable<Observer<KeyboardInfo>>;
    private _onPointerObserver: Nullable<Observer<PointerInfo>>;

    private _keyboardHubEvents: KeyboardHubEvent[] = [];
    private _mouseHubEvents: MouseHubEvent[] = [];
    private _modifierStates: { [key: string]: boolean } = {}

    /**
     * Observable raised when an event is triggered
     */
    public onEventObservable = new Observable<string>();

    /**
     * Creates a new InputHub
     * @param scene defines the scene where the InputHub belongs
     */
    public constructor(scene: Nullable<Scene> = Engine.LastCreatedScene) {
        this._scene = scene!;

        this._onPointerObserver = this._scene.onPointerObservable.add(evt => {
            let raisedEvents = [];
            for (var mouseEvent of this._mouseHubEvents) {
                let trigger = mouseEvent.trigger;
                if (trigger.button === evt.event.button && (
                    !trigger.released && evt.type == PointerEventTypes.POINTERDOWN ||
                    trigger.released && evt.type == PointerEventTypes.POINTERUP
                )
                ) {
                    if (!this._checkModifier(trigger)) {
                        continue;
                    }

                    if (raisedEvents.indexOf(mouseEvent.name) !== -1) { // Raise events once per call
                        continue;
                    }
                    raisedEvents.push(mouseEvent.name);
                    this.onEventObservable.notifyObservers(mouseEvent.name);
                }
            }
        });

        this._onKeyboardObserver = this._scene.onKeyboardObservable.add(evt => {
            let kbEvent = evt.event;
            // Shift, Alt, Ctrl
            switch (kbEvent.keyCode) {
                case 16:
                    this._modifierStates["shift"] = evt.type == KeyboardEventTypes.KEYDOWN;

                    if (kbEvent.location === 2) {
                        this._modifierStates["shiftRight"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    } else {
                        this._modifierStates["shiftLeft"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    }
                    return;
                case 17:
                    this._modifierStates["ctrl"] = evt.type == KeyboardEventTypes.KEYDOWN;

                    if (kbEvent.location === 2) {
                        this._modifierStates["ctrlRight"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    } else {
                        this._modifierStates["ctrlLeft"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    }
                    return;
                case 18:
                    this._modifierStates["alt"] = evt.type == KeyboardEventTypes.KEYDOWN;

                    if (kbEvent.location === 2) {
                        this._modifierStates["altRight"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    } else {
                        this._modifierStates["altLeft"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    }
                    return;
            }

            // Regular keys
            let raisedEvents = [];
            for (var keyboardEvent of this._keyboardHubEvents) {
                let trigger = keyboardEvent.trigger;
                if (trigger.keyCode === kbEvent.keyCode && (
                    !trigger.released && evt.type == KeyboardEventTypes.KEYDOWN ||
                    trigger.released && evt.type == KeyboardEventTypes.KEYUP
                )
                ) {
                    if (!this._checkModifier(trigger)) {
                        continue;
                    }

                    if (raisedEvents.indexOf(keyboardEvent.name) !== -1) { // Raise events once per call
                        continue;
                    }
                    raisedEvents.push(keyboardEvent.name);
                    this.onEventObservable.notifyObservers(keyboardEvent.name);
                }
            }
        });
    }


    private _checkModifier(trigger: IInputHubEventTrigger) {
        if (trigger.altModifier) {
            if (!this._checkKeyModifier("alt", trigger)) {
                return false;
            }
        }
        if (trigger.shiftModifier) {
            if (!this._checkKeyModifier("shift", trigger)) {
                return false;
            }
        }
        if (trigger.ctrlModifier) {
            if (!this._checkKeyModifier("ctrl", trigger)) {
                return false;
            }
        }

        return true;
    }

    private _checkKeyModifier(prefix: string, trigger: IInputHubEventTrigger) {
        if (!this._modifierStates[prefix]) {
            return false;
        }

        if (trigger.rightModifier !== undefined) {
            if (trigger.rightModifier && !this._modifierStates[prefix + "Right"]) {
                return false;
            } else if (trigger.rightModifier === false && !this._modifierStates[prefix + "Left"]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Add a new event and its list of triggers
     * @param name defines the name of the event to raise
     * @param triggers defines the list of triggers that can raise that event
     */
    public addEvent(name: string, triggers: IInputHubEventTrigger[]) {
        for (var trigger of triggers) {
            switch (trigger.device) {
                case InputHubDevice.Keyboard:
                    this.addKeyboardEvent(name, trigger as IInputHubKeyboardEventTrigger);
                    break;
                case InputHubDevice.Mouse:
                    this.addMouseEvent(name, trigger as IInputHubMouseEventTrigger);
                    break;
            }
        }
    }

    /**
     * Specifically add an event triggered by a keyboard event
     * @param name defines the name of the event to raise
     * @param trigger defines the trigger that can raise that event
     */
    public addKeyboardEvent(name: string, trigger: IInputHubKeyboardEventTrigger) {
        this._keyboardHubEvents.push(new KeyboardHubEvent(name, trigger));
    }

    /**
     * Specifically add an event triggered by a mouse event
     * @param name defines the name of the event to raise
     * @param trigger defines the trigger that can raise that event
     */
    public addMouseEvent(name: string, trigger: IInputHubMouseEventTrigger) {
        this._mouseHubEvents.push(new MouseHubEvent(name, trigger));
    }

    /**
     * Release associated resources
     */
    public dispose() {
        if (this._onKeyboardObserver) {
            this._scene.onKeyboardObservable.remove(this._onKeyboardObserver);
            this._onKeyboardObserver = null;
        }

        if (this._onPointerObserver) {
            this._scene.onPointerObservable.remove(this._onPointerObserver);
            this._onPointerObserver = null;
        }

        this.onEventObservable.clear();
    }
}