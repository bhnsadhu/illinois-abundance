/** Hosting outages may return HTML instead of the API's normal JSON response. */
export async function readApiResponse(response: Response) {
  try {
    const result = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid response');
    return result;
  } catch {
    throw new Error('We couldn’t complete that request. Please try again in a moment.');
  }
}
