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
}

/** @hidden */
class KeyboardEvent {
    constructor(public name: string, public trigger: InputHubKeyboardEventTrigger) {
    }
}

/**
 * Class used to abstract inputs by adding an event system on top of hardware
 */
export class InputHub implements IDisposable {
    private _scene: Scene;
    private _onKeyboardObserver: Nullable<Observer<KeyboardInfo>>;

    private _keyboardEvents: KeyboardEvent[] = [];

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
            for (var keyboardEvent of this._keyboardEvents) {
                if (keyboardEvent.trigger.keyCode === evt.event.keyCode && (
                    !keyboardEvent.trigger.released && evt.type == KeyboardEventTypes.KEYDOWN ||
                    keyboardEvent.trigger.released && evt.type == KeyboardEventTypes.KEYUP
                )
                ) {
                    if (
                        (!keyboardEvent.trigger.altModifier || evt.event.altKey) &&
                        (!keyboardEvent.trigger.shiftModifier || evt.event.shiftKey) &&
                        (!keyboardEvent.trigger.ctrlModifier || evt.event.ctrlKey)
                    ) {
                        // TODO: make sure we do not raise multiple time the same event
                        this.onEventObservable.notifyObservers(keyboardEvent.name);
                    }
                }
            }
        });
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
        this._keyboardEvents.push(new KeyboardEvent(name, trigger));
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