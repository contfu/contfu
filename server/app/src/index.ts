import { merge } from "rxjs";
import { app, processEvents } from "./server";
import { sync } from "./sync/sync-service";

app.listen(3000);

merge(processEvents(), sync()).subscribe();
