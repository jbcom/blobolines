import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { ManualModal } from "../ManualModal";

test("ManualModal renders open with the mechanics", async () => {
  const screen = await render(<ManualModal open onOpenChange={() => {}} />);

  await expect.element(screen.getByTestId("manual")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "How to play" })).toBeVisible();
  await expect.element(screen.getByText("Charge launch")).toBeVisible();
  await expect.element(screen.getByText("Hyper-thrust")).toBeVisible();
});
