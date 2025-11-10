import { useEffect, useState } from 'react';

interface DynamicPackingListProps {
  expeditionLotNumber: string;
  productionDate: string;
  miningCompany: string;
  refineryName: string;
  refineryAddress: string;
  refineryCountry: string;
  freightCompany: string;
  ingots: Array<{
    ingotBoxNumber: string;
    netWeight: number;
    grossWeight: number;
    sealNumber1: string;
    sealNumber2: string;
  }>;
  signatories: Array<{
    position: string;
    name: string;
  }>;
}

export function DynamicPackingList({
  expeditionLotNumber,
  productionDate,
  miningCompany,
  refineryName,
  refineryAddress,
  refineryCountry,
  freightCompany,
  ingots,
  signatories,
}: DynamicPackingListProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const totalNetWeight = ingots.reduce((sum, ingot) => sum + ingot.netWeight, 0);
  const totalGrossWeight = ingots.reduce((sum, ingot) => sum + ingot.grossWeight, 0);

  const formattedDate = new Date(productionDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });

  return (
    <div className="bg-white p-6 text-sm" style={{ width: '100%', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold mb-2 uppercase">{refineryName}</h1>
          <div className="text-xs">
            <div><strong>Shipped to:</strong></div>
            <div>{refineryAddress}</div>
            <div>{refineryCountry}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="bg-yellow-50 p-3 rounded-lg border-2 border-yellow-600">
            <div className="text-yellow-900 font-bold text-base">{miningCompany}</div>
            <div className="text-xs text-yellow-800">HUMMINGBIRD RESOURCES</div>
          </div>
          <div className="mt-3 text-xs">
            <div><strong>From:</strong></div>
            <div>Societe des Mines de Komana SA</div>
            <div>Magnambougou Faso Kanu</div>
            <div>Commune VI</div>
            <div>Bamako, Mali</div>
          </div>
        </div>
      </div>

      <div className="border-2 border-gray-800 p-2 text-center font-bold mb-4">
        PACKING LIST
      </div>

      {/* Date and Expedition Info */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div>
          <strong>DATE:</strong> <span className="ml-2">{formattedDate}</span>
        </div>
        <div>
          <strong>EXPEDITION / LOT No:</strong> <span className="ml-2">{expeditionLotNumber}</span>
        </div>
      </div>

      {/* Ingots Table */}
      <table className="w-full border-collapse border border-gray-400 mb-6 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 p-2 text-left">Ingot & Box #</th>
            <th className="border border-gray-400 p-2 text-right">Ingot Net Weight (g)</th>
            <th className="border border-gray-400 p-2 text-right">Ingot Gross Weight (g)</th>
            <th className="border border-gray-400 p-2 text-center">Seal Number 1</th>
            <th className="border border-gray-400 p-2 text-center">Seal Number 2</th>
          </tr>
        </thead>
        <tbody>
          {ingots.length > 0 ? (
            ingots.map((ingot, index) => (
              <tr key={index}>
                <td className="border border-gray-400 p-2">{ingot.ingotBoxNumber}</td>
                <td className="border border-gray-400 p-2 text-right">{ingot.netWeight.toFixed(2)}</td>
                <td className="border border-gray-400 p-2 text-right">{ingot.grossWeight.toFixed(2)}</td>
                <td className="border border-gray-400 p-2 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-green-600">✓</span> {ingot.sealNumber1}
                  </span>
                </td>
                <td className="border border-gray-400 p-2 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-green-600">✓</span> {ingot.sealNumber2}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="border border-gray-400 p-8 text-center text-gray-400">
                No ingots added yet
              </td>
            </tr>
          )}
          {/* Single empty row */}
          {ingots.length > 0 && (
            <tr>
              <td className="border border-gray-400 p-2">&nbsp;</td>
              <td className="border border-gray-400 p-2">&nbsp;</td>
              <td className="border border-gray-400 p-2">&nbsp;</td>
              <td className="border border-gray-400 p-2">&nbsp;</td>
              <td className="border border-gray-400 p-2">&nbsp;</td>
            </tr>
          )}
          {/* Totals */}
          <tr className="font-bold bg-gray-50">
            <td className="border-2 border-gray-800 p-2">TOTAL</td>
            <td className="border-2 border-gray-800 p-2 text-right">{totalNetWeight.toFixed(2)}</td>
            <td className="border-2 border-gray-800 p-2 text-right">{totalGrossWeight.toFixed(2)}</td>
            <td className="border-2 border-gray-800 p-2" colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      {/* Freight Company */}
      {freightCompany && (
        <div className="mb-4 text-xs">
          <strong>Freight Company:</strong> <span className="ml-2">{freightCompany}</span>
        </div>
      )}

      {/* Signatures Table */}
      <table className="w-full border-collapse border border-gray-400 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 p-2 text-left w-1/3">POSITION</th>
            <th className="border border-gray-400 p-2 text-left w-1/3">NAME</th>
            <th className="border border-gray-400 p-2 text-left w-1/3">SIGNATURE</th>
          </tr>
        </thead>
        <tbody>
          {signatories.length > 0 ? (
            signatories.map((signatory, index) => (
              <tr key={index}>
                <td className="border border-gray-400 p-3">{signatory.position}</td>
                <td className="border border-gray-400 p-3 font-medium text-blue-900">{signatory.name}</td>
                <td className="border border-gray-400 p-3"></td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="border border-gray-400 p-6 text-center text-gray-400">
                No signatories added yet
              </td>
            </tr>
          )}
          {/* Single empty row */}
          {signatories.length > 0 && (
            <tr>
              <td className="border border-gray-400 p-3">&nbsp;</td>
              <td className="border border-gray-400 p-3">&nbsp;</td>
              <td className="border border-gray-400 p-3">&nbsp;</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
