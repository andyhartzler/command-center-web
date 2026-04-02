import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  
  if (!projectId) {
    return NextResponse.json({ error: 'Missing Nest Project ID' }, { status: 400 });
  }

  try {
    // Mock response for Google Smart Device Management API
    const mockData = {
      devices: [
        {
          name: "enterprises/project-id/devices/device-id",
          type: "sdm.devices.types.THERMOSTAT",
          traits: {
            "sdm.devices.traits.Info": { customName: "Hallway Thermostat" },
            "sdm.devices.traits.Temperature": { ambientTemperatureCelsius: 22.5 },
            "sdm.devices.traits.Humidity": { ambientHumidityPercent: 45 },
            "sdm.devices.traits.ThermostatMode": { mode: "COOL", availableModes: ["HEAT", "COOL", "HEATCOOL", "OFF"] },
            "sdm.devices.traits.ThermostatTemperatureSetpoint": { coolCelsius: 22.0 }
          }
        }
      ]
    };

    return NextResponse.json(mockData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch Nest data' }, { status: 500 });
  }
}
