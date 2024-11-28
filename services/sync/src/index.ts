import { migrate } from "@contfu/db";
import { merge } from "rxjs";
import { app, processItems$ } from "./server";
import { sync$ } from "./sync/sync-service";

await migrate(process.env.MIGRATIONS_FOLDER);

app.listen(3000);

merge(processItems$, sync$).subscribe();
