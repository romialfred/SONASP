import { useEffect, useState } from 'react';
import { roundUpToFixed } from '@/utils/numberUtils';
import { PAYS_NATIONAL } from '@/constants/site';

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

  // Format de date conforme: 31-Oct-25 (avec tirets)
  const formattedDate = new Date(productionDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).replace(/ /g, '-'); // Remplace les espaces par des tirets

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
          {/* L'expéditeur était une société malienne d'un autre exploitant :
              « Hummingbird Resources », Bamako. L'or part du Burkina, sous le
              nom de la SONASP et de la mine d'origine. */}
          <div className="bg-yellow-50 p-3 rounded-lg border-2 border-yellow-600">
            <div className="text-yellow-900 font-bold text-base">{miningCompany}</div>
            <div className="text-xs text-yellow-800">MINE OF ORIGIN</div>
          </div>
          <div className="mt-3 text-xs">
            <div><strong>Shipper:</strong></div>
            <div>SONASP</div>
            <div>Société Nationale des Substances Précieuses</div>
            <div>Ouagadougou, {PAYS_NATIONAL}</div>
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

      {/* Ingots Table - Format Gouvernemental Conforme */}
      <table className="w-full border-collapse border border-gray-800 mb-6 text-xs">
        <thead>
          <tr style={{ backgroundColor: '#C69C3D' }}>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900">Ingot & Box #</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900">Ingot Net<br/>Weight (g)</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900">Ingot Gross<br/>Weight (g)</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900">Seal Number 1</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900">Seal Number 2</th>
          </tr>
        </thead>
        <tbody>
          {ingots.length > 0 ? (
            ingots.map((ingot, index) => (
              <tr key={index} className="bg-white">
                <td className="border border-gray-400 p-2 text-center font-medium">{ingot.ingotBoxNumber}</td>
                <td className="border border-gray-400 p-2 text-center">{roundUpToFixed(ingot.netWeight, 2)}</td>
                <td className="border border-gray-400 p-2 text-center">{roundUpToFixed(ingot.grossWeight, 2)}</td>
                <td className="border border-gray-400 p-2 text-center">
                  <span className="inline-flex items-center justify-center gap-1">
                    <span className="text-green-600 text-base">✓</span> {ingot.sealNumber1}
                  </span>
                </td>
                <td className="border border-gray-400 p-2 text-center">
                  <span className="inline-flex items-center justify-center gap-1">
                    <span className="text-green-600 text-base">✓</span> {ingot.sealNumber2}
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
          {/* Totals - Format Gouvernemental avec fond jaune/orange */}
          <tr className="font-bold" style={{ backgroundColor: '#C69C3D' }}>
            <td className="border border-gray-800 p-2 text-left text-gray-900">TOTAL</td>
            <td className="border border-gray-800 p-2 text-center text-gray-900">{roundUpToFixed(totalNetWeight, 2)}</td>
            <td className="border border-gray-800 p-2 text-center text-gray-900">{roundUpToFixed(totalGrossWeight, 2)}</td>
            <td className="border border-gray-800 p-2" colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      {/* Freight Company */}
      {freightCompany && (
        <div className="mb-4 text-xs">
          <strong>Freight Company:</strong> <span className="ml-2">{freightCompany}</span>
        </div>
      )}

      {/* Signatures Table - Format Gouvernemental Conforme */}
      <table className="w-full border-collapse border border-gray-800 text-xs">
        <thead>
          <tr style={{ backgroundColor: '#ADD8E6' }}>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900 w-1/3">POSITION</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900 w-1/3">NAME</th>
            <th className="border border-gray-800 p-2 text-center font-bold text-gray-900 w-1/3">SIGNATURE</th>
          </tr>
        </thead>
        <tbody>
          {signatories.length > 0 ? (
            signatories.map((signatory, index) => (
              <tr key={index} className="bg-white">
                <td className="border border-gray-400 p-3 text-left font-medium">{signatory.position}</td>
                <td className="border border-gray-400 p-3 text-center font-semibold">{signatory.name}</td>
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
        </tbody>
      </table>
    </div>
  );
}
