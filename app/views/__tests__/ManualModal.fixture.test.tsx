import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { ManualModal } from "../ManualModal";

test("ManualModal renders open with the mechanics", async () => {
  const screen = await render(<ManualModal open onOpenChange={() => {}} />);

  await expect.element(screen.getByTestId("manual")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "How to play" })).toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 3, name: "Climb", exact: true }))
    .toBeVisible();
  await expect.element(screen.getByRole("heading", { level: 3, name: "Run aids" })).toBeVisible();
  await expect.element(screen.getByRole("heading", { level: 3, name: "Goals" })).toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Charge launch" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Read the route" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Hyper-thrust" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Shield", exact: true }))
    .toBeVisible();
  await expect.element(screen.getByRole("heading", { level: 4, name: "Slow-mo" })).toBeVisible();
  await expect.element(screen.getByRole("heading", { level: 4, name: "2x score" })).toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Multi-bounce" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "High-altitude hazards" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("heading", { level: 4, name: "Daily tower" }))
    .toBeVisible();
  await expect.element(screen.getByRole("heading", { level: 4, name: "Next climb" })).toBeVisible();
});

test("ManualModal uses the capped scrollable dialog shell", async () => {
  const screen = await render(<ManualModal open onOpenChange={() => {}} />);
  const content = screen.getByTestId("manual").element();

  expect((content as HTMLElement).style.maxHeight).toMatch(/calc\(/);
  expect(content.querySelector(".overflow-y-auto")).toBeTruthy();
});
