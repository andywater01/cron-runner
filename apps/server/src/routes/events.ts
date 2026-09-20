/**
 * GET /api/events  Server-Sent Events stream of ServerEvent JSON.
 * The web app keeps one EventSource open and invalidates react-query caches on job/run events.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribe } from "../events";

export const eventsRoute = new Hono();

eventsRoute.get("/", (c) =>
  streamSSE(c, async (stream) => {
    let id = 0;
    const unsubscribe = subscribe((event) => {
      void stream.writeSSE({ data: JSON.stringify(event), event: event.type, id: String(id++) });
    });
    stream.onAbort(unsubscribe);
    // keep-alive ping every 25s so proxies/browsers don't drop the connection
    while (!stream.aborted) {
      await stream.writeSSE({ event: "ping", data: "" });
      await stream.sleep(25_000);
    }
  }),
);
