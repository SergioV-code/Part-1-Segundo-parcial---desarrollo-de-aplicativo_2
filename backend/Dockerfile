FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["EDUMETRICS-DR.csproj", "./"]
RUN dotnet restore "EDUMETRICS-DR.csproj"
COPY . .
RUN dotnet publish "EDUMETRICS-DR.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "EDUMETRICS-DR.dll"]
