type Listener<Payload> = (payload: Payload) => void;

type ListenerMap<Events extends object> = {
    [EventName in keyof Events]?: Set<Listener<Events[EventName]>>;
};

export class EventBus<Events extends object> {
    private readonly listeners: ListenerMap<Events> = {};

    on<EventName extends keyof Events>(event: EventName, listener: Listener<Events[EventName]>): () => void {
        const current = this.listeners[event] as Set<Listener<Events[EventName]>> | undefined;
        const bucket = current ?? new Set<Listener<Events[EventName]>>();

        bucket.add(listener);
        this.listeners[event] = bucket as ListenerMap<Events>[EventName];

        return () => bucket.delete(listener);
    }

    emit<EventName extends keyof Events>(event: EventName, payload: Events[EventName]): void {
        const bucket = this.listeners[event] as Set<Listener<Events[EventName]>> | undefined;
        bucket?.forEach((listener) => listener(payload));
    }

    clear(): void {
        (Object.keys(this.listeners) as Array<keyof Events>).forEach((event) => {
            delete this.listeners[event];
        });
    }
}
