import { handleFileRequest as handleFileRequestImpl } from "./contfu";

// oxlint-disable-next-line typescript/no-redundant-type-constituents
type RouteRequest = Request & { params: Record<string, string> };

export async function handleFileRequest(request: RouteRequest): Promise<Response> {
  return handleFileRequestImpl(request, decodeURIComponent(request.params.path));
}
