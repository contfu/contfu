import { merge } from "rxjs";
import { app, processItems$ } from "./server";
import { sync$ } from "./sync/sync-service";

app.listen(3000);

merge(processItems$, sync$).subscribe();
