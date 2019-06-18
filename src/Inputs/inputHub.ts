import { Scene, IDisposable } from '../scene';
import { Engine } from '../Engines/engine';
import { Nullable } from '../types';
import { Observer, Observable } from '../Misc/observable';
import { KeyboardInfo, KeyboardEventTypes } from '../Events/keyboardEvents';

/**
 * List of supported devices
 */
export enum InputHubDevice {
    /** Keyboard */
    Keyboard
}

/**
 * Interface used to define an event trigger
 */
export interface IInputHubEventTrigger {
    /**
     * Define the hardware device that will emit the event
     */
    device: InputHubDevice
}

/**
 * Class used to represent an event from the keyboard
 */
export class InputHubKeyboardEventTrigger implements IInputHubEventTrigger {
    /**
    * Define the hardware device that will emit the event
    */
    device: InputHubDevice;
    /** Key code */
    keyCode: number;
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
    rightModifier?: boolean
}

/** @hidden */
class KeyboardHubEvent {
    constructor(public name: string, public trigger: InputHubKeyboardEventTrigger) {
    }
}

/**
 * Class used to abstract inputs by adding an event system on top of hardware
 */
export class InputHub implements IDisposable {
    private _scene: Scene;
    private _onKeyboardObserver: Nullable<Observer<KeyboardInfo>>;

    private _keyboardHubEvents: KeyboardHubEvent[] = [];
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

        this._onKeyboardObserver = this._scene.onKeyboardObservable.add(evt => {
            let kbEvent = evt.event;
            // Shift, Alt, Ctrl
            switch (kbEvent.keyCode) {
                case 16:
                    if (kbEvent.location === 2) {
                        this._modifierStates["shiftRight"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    } else {
                        this._modifierStates["shiftLeft"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    }
                    return;
                case 17:
                    if (kbEvent.location === 2) {
                        this._modifierStates["ctrlRight"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    } else {
                        this._modifierStates["ctrlLeft"] = evt.type == KeyboardEventTypes.KEYDOWN;
                    }
                    return;
                case 18:
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
                    if (trigger.altModifier) {
                        if (!this._checkKeyModifier("alt", trigger, kbEvent)) {
                            continue;
                        }
                    }
                    if (trigger.shiftModifier) {
                        if (!this._checkKeyModifier("shift", trigger, kbEvent)) {
                            continue;
                        }
                    }
                    if (trigger.ctrlModifier) {
                        if (!this._checkKeyModifier("ctrl", trigger, kbEvent)) {
                            continue;
                        }
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

    private _checkKeyModifier(prefix: string, trigger: InputHubKeyboardEventTrigger, keyEvent: any) {
        if (!keyEvent[prefix + "Key"]) {
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
                    this.addKeyboardEvent(name, trigger as InputHubKeyboardEventTrigger);
                    break;
            }
        }
    }

    /**
     * Specifically add an event triggered by a keyboard event
     * @param name defines the name of the event to raise
     * @param trigger defines the trigger that can raise that event
     */
    public addKeyboardEvent(name: string, trigger: InputHubKeyboardEventTrigger) {
        this._keyboardHubEvents.push(new KeyboardHubEvent(name, trigger));
    }

    /**
     * Release associated resources
     */
    public dispose() {
        if (this._onKeyboardObserver) {
            this._scene.onKeyboardObservable.remove(this._onKeyboardObserver);
            this._onKeyboardObserver = null;
        }

        this.onEventObservable.clear();
    }
}