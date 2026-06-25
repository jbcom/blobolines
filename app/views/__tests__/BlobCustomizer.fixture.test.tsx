import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { BlobCustomizer } from "../BlobCustomizer";

// The shadcn Dialog had a Motion calc()↔% interpolation bug that left the content stuck
// at opacity 0. This renders the customizer open and asserts its content is visible —
// guarding that regression.
test("BlobCustomizer renders open with the skin grid visible", async () => {
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);

  const panel = screen.getByTestId("customizer");
  await expect.element(panel).toBeInTheDocument();
  await expect.element(panel).toBeVisible();
  // The skin tiles + the heading are present (incl. the Nebula apex-reward skin).
  await expect.element(screen.getByText("Goo Customizer")).toBeVisible();
  await expect.element(screen.getByText("Mango")).toBeVisible();
  await expect.element(screen.getByText("Berry")).toBeVisible();
  await expect.element(screen.getByText("Nebula")).toBeVisible();
});

test("BlobCustomizer keeps dense skin content separate from the fixed Done action", async () => {
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);

  const panel = screen.getByTestId("customizer").element();
  expect(panel.className).toContain("overflow-hidden");
  const scrollBody = screen.getByTestId("customizer-scroll-body").element();
  expect(scrollBody.className).toContain("overflow-y-auto");
  expect(scrollBody.className).toContain("flex-1");
  expect(screen.getByRole("button", { name: "Done" }).element().className).not.toContain("mt-");
});
