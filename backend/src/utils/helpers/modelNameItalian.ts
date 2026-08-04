import { Prisma } from "@prisma/client";

export const ModelNameItalian: Record<Prisma.ModelName, string> = {
    User: "utente",
    PermissionConfig: "configurazione permesso",
    HiddenComponentConfig: "configurazione componente nascosto",
    Role: "ruolo",
    RoleToUser: "associazione ruolo-utente",
    Log: "log",
    Config: "configurazione",
    Person: "anagrafica",
    Contact: "contatto",
    Address: "indirizzo",
    File: "file",
    PersonFile: "file anagrafica",

    // Mirada Tango — fase A
    EventType: "tipo di evento",
    RequirementType: "tipo di requisito",
    ServiceType: "tipo di servizio",
    Organization: "organizzazione",
    OrganizationMember: "membro dell'organizzazione",
    DancerProfile: "profilo da ballerino",
    Venue: "sala",
    Artist: "artista",
    RefundPolicy: "politica di rimborso",

    // Mirada Tango — fase B
    Event: "evento",
    FiscalDeclaration: "dichiarazione fiscale",
    Session: "sessione",
    EventCast: "voce di cast",
    EventRequirement: "requisito dell'evento",
    EventService: "servizio accessorio",
    TicketType: "titolo d'ingresso",
    TicketTypeSession: "sessione inclusa nel titolo",
    PriceTier: "scaglione di prezzo",

    // Mirada Tango — fase C (il motore di capienza)
    CapacityQuota: "quota di capienza",
    QuotaConsumption: "consumo di quota",
    Registration: "iscrizione",
    Couple: "coppia",
};

export const italianModelName = (name: Prisma.ModelName): string => ModelNameItalian[name];
