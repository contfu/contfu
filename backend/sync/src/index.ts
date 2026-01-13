import { merge } from "rxjs";
import { app, processItems$ } from "./server";
import { sync$ } from "./sync/sync-service";

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => console.log(`Server started: http://localhost:${port}`));

merge(processItems$, sync$).subscribe();
