import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody, TableCell, TableRow } from "./table";
describe("Table", () => {
  it("renders cells", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});
