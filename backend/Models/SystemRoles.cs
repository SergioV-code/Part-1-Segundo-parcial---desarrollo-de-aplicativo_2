namespace EDUMETRICS_DR.Models;

public static class SystemRoles
{
    public const string Estudiante = "Estudiante";
    public const string AnalistaMinerd = "Analista MINERD";
    public const string AnalistaMescyt = "Analista MESCYT";
    public const string Administrador = "Administrador";

    public const string SoloAnalistas = AnalistaMinerd + "," + AnalistaMescyt;
    public const string SoloBackoffice = Administrador + "," + SoloAnalistas;

    public static readonly string[] All =
    {
        Estudiante,
        AnalistaMinerd,
        AnalistaMescyt,
        Administrador,
    };
}
