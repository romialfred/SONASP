import { describe, expect, it } from 'vitest';
import { BURKINA_FASO_REGIONS } from './burkinaFasoData';
import { BURKINA_PROVINCES } from './burkinaProvinces';
import { findProvinceAt, getProvinceCells, getRegionBoundaries, getRegionCells } from './burkinaRegions';

describe('découpage territorial du Burkina Faso', () => {
  it('assemble les 13 régions à partir des cellules de leurs provinces', () => {
    const cells = getRegionCells();

    expect(cells).toHaveLength(13);
    cells.forEach((cell) => {
      expect(cell.polygons.length).toBeGreaterThanOrEqual(1);
      cell.polygons.forEach((polygon) => expect(polygon.length).toBeGreaterThanOrEqual(3));
    });
    expect(cells.reduce((total, cell) => total + cell.polygons.length, 0)).toBe(45);
  });

  it('trace des limites régionales entre provinces de régions différentes', () => {
    const boundaries = getRegionBoundaries();

    expect(boundaries.length).toBeGreaterThan(10);
    boundaries.forEach((segment) => expect(segment).toHaveLength(2));
  });

  it('produit une cellule non vide pour chacune des 45 provinces', () => {
    const cells = getProvinceCells();

    expect(cells).toHaveLength(45);
    expect(cells).toHaveLength(BURKINA_PROVINCES.length);
    const empty = cells.filter((cell) => cell.polygon.length < 3).map((cell) => cell.name);
    expect(empty).toEqual([]);
  });

  it('rattache chaque chef-lieu à sa propre province', () => {
    const mismatched = BURKINA_PROVINCES.filter((province) => {
      const found = findProvinceAt(province.longitude, province.latitude);
      return found?.name !== province.name;
    }).map((province) => province.name);

    expect(mismatched).toEqual([]);
  });

  it('rattache chaque province à la région annoncée', () => {
    const cells = getProvinceCells();
    const wrongRegion = cells.filter(
      (cell) => BURKINA_PROVINCES.find((province) => province.name === cell.name)?.region !== cell.region
    );

    expect(wrongRegion).toEqual([]);
  });

  // Le clic sur la carte renseigne les listes déroulantes du formulaire : les deux
  // jeux de données doivent nommer régions et provinces exactement de la même façon.
  it('reste aligné avec les listes déroulantes du formulaire', () => {
    const formRegions = BURKINA_FASO_REGIONS.filter((region) => region.country === 'Burkina Faso');
    const formProvinces = new Set(formRegions.flatMap((region) => region.provinces || []));
    const formRegionNames = new Set(formRegions.map((region) => region.name));

    const unknownRegions = [...new Set(BURKINA_PROVINCES.map((province) => province.region))].filter(
      (region) => !formRegionNames.has(region)
    );
    const unknownProvinces = BURKINA_PROVINCES.filter(
      (province) => !formProvinces.has(province.name)
    ).map((province) => province.name);

    expect(unknownRegions).toEqual([]);
    expect(unknownProvinces).toEqual([]);
  });

  it('place Ouagadougou dans le Kadiogo et Gaoua dans le Poni', () => {
    expect(findProvinceAt(-1.5197, 12.3714)?.name).toBe('Kadiogo');
    expect(findProvinceAt(-3.174, 10.325)?.name).toBe('Poni');
    expect(findProvinceAt(-3.174, 10.325)?.region).toBe('Sud-Ouest');
  });
});
